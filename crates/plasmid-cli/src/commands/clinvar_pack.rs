use crate::commands::build::open_maybe_gzip_reader;
use clap::Args;
use plasmid_core::{
    CURATED_ANCHOR_SNPS, DataGovernanceGuard, LicenseType, SubmitterStarRating, VcfDecoder,
    chrom_to_id, id_to_chrom, pyramid::PyramidIndex,
};
use plasmid_format::{CompressionCodec, EntryType, PlasmidBuilder, PlasmidReader};
use std::collections::BTreeMap;
use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter};
use std::path::PathBuf;

const RETAINED_CLINVAR_INFO_KEYS: &[&str] = &[
    "ALLELEID",
    "CLNDN",
    "CLNHGVS",
    "CLNREVSTAT",
    "CLNSIG",
    "GENEINFO",
    "MC",
    "ORIGIN",
    "RS",
    "ONC",
    "ONCDN",
    "ONCREVSTAT",
    "SCI",
    "AF_TGP",
    "AF_EXAC",
    "AF_ESP",
];

const CLINVAR_RAW_BLOCK_BYTES: usize = 72_000;

#[derive(Args, Debug)]
pub struct ClinvarPackArgs {
    /// Path to NCBI ClinVar VCF or VCF.GZ file (e.g. clinvar.vcf.gz)
    #[arg(short, long)]
    pub input: PathBuf,

    /// Output .plasmid container path
    #[arg(short, long)]
    pub output: PathBuf,

    /// Reference assembly identifier
    #[arg(short, long, default_value = "GRCh38")]
    pub reference: String,

    /// Maximum number of clinically actionable variants to pack across all 25 chromosomes
    #[arg(long, default_value_t = 18_000)]
    pub max_variants: usize,

    /// Minimum ClinVar review stars for germline Pathogenic/Likely_pathogenic inclusion (0..=4)
    #[arg(long, default_value_t = 2)]
    pub min_stars: u8,

    /// Maximum leaf entries per hierarchical B+Tree leaf node
    #[arg(long, default_value_t = 64)]
    pub entries_per_leaf: usize,
}

#[derive(Debug, Clone)]
struct CandidateRecord {
    chrom_id: u16,
    pos: u64,
    end_pos: u64,
    stars: u8,
    compact_line: String,
}

fn classify_clinvar_tier(
    clnsig: &str,
    onc: &str,
    stars: u8,
    min_stars_germline: u8,
    is_anchor: bool,
) -> Option<u8> {
    if is_anchor {
        return Some(0);
    }

    let sig_lower = clnsig.to_ascii_lowercase();
    let onc_lower = onc.to_ascii_lowercase();

    let is_benign_or_conflict = sig_lower.contains("benign") || sig_lower.contains("conflict");

    let is_drug_or_risk = sig_lower.contains("drug_response")
        || sig_lower.contains("drug response")
        || sig_lower.contains("risk_factor")
        || sig_lower.contains("risk factor");
    let is_oncogenic = !onc_lower.contains("benign")
        && !onc_lower.contains("conflict")
        && (onc_lower.contains("oncogenic") || sig_lower.contains("oncogenic"));

    if is_drug_or_risk || is_oncogenic {
        return Some(0);
    }

    let is_pathogenic = !is_benign_or_conflict && sig_lower.contains("pathogenic");
    if !is_pathogenic {
        return None;
    }

    if stars >= 3 {
        Some(0)
    } else if stars >= min_stars_germline {
        Some(1)
    } else if stars >= 1 {
        Some(2)
    } else {
        None
    }
}

pub fn execute(args: ClinvarPackArgs) -> Result<(), Box<dyn std::error::Error>> {
    // Enforce RFC-0003 Data Governance Policy (Public Domain NCBI ClinVar only)
    DataGovernanceGuard::validate_odbl_partition(
        LicenseType::PublicDomain,
        true,
        "NCBI ClinVar Public Domain",
    )?;

    let reader = open_maybe_gzip_reader(&args.input)?;

    let mut tier0: Vec<CandidateRecord> = Vec::new();
    let mut tier1_by_chrom: BTreeMap<u16, Vec<CandidateRecord>> = BTreeMap::new();
    let mut tier2_by_chrom: BTreeMap<u16, Vec<CandidateRecord>> = BTreeMap::new();
    let mut total_scanned = 0usize;
    let mut file_date: Option<String> = None;

    for line_res in reader.lines() {
        let raw_line = line_res?;
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }
        if line.starts_with('#') {
            if let Some(date_val) = line.strip_prefix("##fileDate=") {
                file_date = Some(date_val.trim().to_string());
            }
            continue;
        }
        total_scanned += 1;

        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 8 {
            continue;
        }

        let Ok(chrom_id) = chrom_to_id(cols[0]) else {
            continue;
        };
        let Ok(pos) = cols[1].parse::<u64>() else {
            continue;
        };
        if pos == 0 {
            continue;
        }

        let ref_allele = cols[3].trim();
        let alt_allele = cols[4].trim();
        if ref_allele.is_empty()
            || alt_allele.is_empty()
            || alt_allele == "."
            || ref_allele.len() > 64
            || alt_allele.len() > 64
        {
            continue;
        }

        let mut clnsig = "";
        let mut clnrevstat = "";
        let mut onc = "";
        let mut oncrevstat = "";
        let mut rs_val = "";
        let mut compact_kv: Vec<String> = Vec::with_capacity(10);

        for item in cols[7].split(';') {
            let Some((k, v)) = item.split_once('=') else {
                continue;
            };
            let k = k.trim();
            let v = v.trim();
            match k {
                "CLNSIG" => clnsig = v,
                "CLNREVSTAT" => clnrevstat = v,
                "ONC" => onc = v,
                "ONCREVSTAT" => oncrevstat = v,
                "RS" => rs_val = v,
                _ => {}
            }
            if RETAINED_CLINVAR_INFO_KEYS.contains(&k) {
                let clean_v = if k == "CLNDN" && v.len() > 160 {
                    let short: Vec<&str> = v.split('|').take(3).collect();
                    short.join("|")
                } else {
                    v.to_string()
                };
                compact_kv.push(format!("{k}={clean_v}"));
            }
        }

        let is_anchor = CURATED_ANCHOR_SNPS.iter().any(|a| {
            a.chrom_id == chrom_id
                && (a.hg38_pos == pos
                    || (!rs_val.is_empty() && a.rsid.strip_prefix("rs") == Some(rs_val)))
        });

        let rev_source = if !clnrevstat.is_empty() {
            clnrevstat
        } else {
            oncrevstat
        };
        let stars = SubmitterStarRating::from_review_status(rev_source).stars;

        let Some(tier) = classify_clinvar_tier(clnsig, onc, stars, args.min_stars, is_anchor)
        else {
            continue;
        };

        let compact_info = compact_kv.join(";");
        let compact_line = format!(
            "{}\t{}\t{}\t{}\t{}\t.\t.\t{}\n",
            cols[0], pos, cols[2], ref_allele, alt_allele, compact_info
        );
        let end_pos = pos + (ref_allele.len().max(1) as u64) - 1;
        let rec = CandidateRecord {
            chrom_id,
            pos,
            end_pos,
            stars,
            compact_line,
        };

        match tier {
            0 => tier0.push(rec),
            1 => tier1_by_chrom.entry(chrom_id).or_default().push(rec),
            _ => tier2_by_chrom.entry(chrom_id).or_default().push(rec),
        }
    }

    let mut selected: Vec<CandidateRecord> = Vec::with_capacity(args.max_variants.max(tier0.len()));
    let mut counts_per_chrom = [0usize; 26];

    for rec in tier0 {
        if (rec.chrom_id as usize) < counts_per_chrom.len() {
            counts_per_chrom[rec.chrom_id as usize] += 1;
        }
        selected.push(rec);
    }

    for bucket in tier1_by_chrom
        .values_mut()
        .chain(tier2_by_chrom.values_mut())
    {
        bucket.sort_by(|a, b| {
            let a_has_rs = a.compact_line.contains(";RS=") || a.compact_line.contains("\tRS=");
            let b_has_rs = b.compact_line.contains(";RS=") || b.compact_line.contains("\tRS=");
            b.stars
                .cmp(&a.stars)
                .then_with(|| b_has_rs.cmp(&a_has_rs))
                .then_with(|| a.pos.cmp(&b.pos))
        });
    }

    // Guarantee coverage across all 25 chromosomes (chr1..chr22, chrX, chrY, chrM)
    for cid in 1u16..=25u16 {
        let min_floor = 24usize;
        if counts_per_chrom[cid as usize] < min_floor {
            let needed = min_floor - counts_per_chrom[cid as usize];
            let mut taken = 0usize;
            if let Some(t1) = tier1_by_chrom.get_mut(&cid) {
                while taken < needed && !t1.is_empty() {
                    selected.push(t1.remove(0));
                    counts_per_chrom[cid as usize] += 1;
                    taken += 1;
                }
            }
            if taken < needed
                && let Some(t2) = tier2_by_chrom.get_mut(&cid)
            {
                while taken < needed && !t2.is_empty() {
                    selected.push(t2.remove(0));
                    counts_per_chrom[cid as usize] += 1;
                    taken += 1;
                }
            }
        }
    }

    // Round-robin across chromosomes up to max_variants
    let mut cursors = [0usize; 26];
    while selected.len() < args.max_variants {
        let mut added_in_round = false;
        for cid in 1u16..=25u16 {
            if selected.len() >= args.max_variants {
                break;
            }
            if let Some(t1) = tier1_by_chrom.get(&cid) {
                let idx = cursors[cid as usize];
                if idx < t1.len() {
                    selected.push(t1[idx].clone());
                    cursors[cid as usize] += 1;
                    counts_per_chrom[cid as usize] += 1;
                    added_in_round = true;
                }
            }
        }
        if !added_in_round {
            break;
        }
    }

    if selected.is_empty() {
        return Err("No matching ClinVar variants found in input VCF".into());
    }

    selected.sort_by(|a, b| a.chrom_id.cmp(&b.chrom_id).then_with(|| a.pos.cmp(&b.pos)));

    let mut builder = PlasmidBuilder::new(&args.reference);
    builder.set_compression(CompressionCodec::Zstd);
    let mut pyramid = PyramidIndex::new(&args.reference);

    let mut cur_chrom: Option<u16> = None;
    let mut block_start = 0u64;
    let mut block_end = 0u64;
    let mut block_buf = Vec::<u8>::new();
    let mut raw_uncompressed_bytes = 0usize;
    let mut entry_blocks = 0usize;

    for rec in &selected {
        let chrom_label = id_to_chrom(rec.chrom_id);
        if let Ok(decoded) = VcfDecoder::decode_slice(rec.compact_line.as_bytes()) {
            for v in &decoded {
                pyramid.ingest_variant(&chrom_label, v);
            }
        }

        let line_bytes = rec.compact_line.as_bytes();
        raw_uncompressed_bytes += line_bytes.len();

        let should_flush = match cur_chrom {
            Some(prev_cid) => {
                prev_cid != rec.chrom_id
                    || (!block_buf.is_empty()
                        && block_buf.len() + line_bytes.len() > CLINVAR_RAW_BLOCK_BYTES)
            }
            None => false,
        };

        if should_flush && let Some(prev_cid) = cur_chrom {
            builder.add_item(
                prev_cid,
                EntryType::VcfVariant,
                block_start,
                block_end,
                std::mem::take(&mut block_buf),
            );
            entry_blocks += 1;
        }

        if block_buf.is_empty() {
            cur_chrom = Some(rec.chrom_id);
            block_start = rec.pos;
            block_end = rec.end_pos;
        } else {
            block_start = block_start.min(rec.pos);
            block_end = block_end.max(rec.end_pos);
        }

        block_buf.extend_from_slice(line_bytes);
    }

    if !block_buf.is_empty()
        && let Some(cid) = cur_chrom
    {
        builder.add_item(
            cid,
            EntryType::VcfVariant,
            block_start,
            block_end,
            block_buf,
        );
        entry_blocks += 1;
    }

    let chrom_summary: BTreeMap<String, usize> = (1u16..=25u16)
        .filter(|&cid| counts_per_chrom[cid as usize] > 0)
        .map(|cid| (id_to_chrom(cid), counts_per_chrom[cid as usize]))
        .collect();

    let mut meta_val = serde_json::json!({
        "dataset": "NCBI ClinVar Clinical Reference Pack",
        "source": "https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/clinvar.vcf.gz",
        "clinvar_release_date": file_date.unwrap_or_else(|| "GRCh38-current".to_string()),
        "license": "Public Domain (NCBI / NLM)",
        "rfc0003_compliant": true,
        "reference_build": args.reference,
        "compression": "zstd",
        "total_clinvar_scanned": total_scanned,
        "variant_count": selected.len(),
        "raw_vcf_bytes": raw_uncompressed_bytes,
        "contig_counts": chrom_summary,
    });
    if let Ok(pyr_val) = serde_json::to_value(&pyramid) {
        meta_val["pyramid"] = pyr_val;
    }
    builder.set_metadata(&meta_val.to_string());

    if let Some(parent) = args.output.parent()
        && !parent.as_os_str().is_empty()
    {
        std::fs::create_dir_all(parent)?;
    }

    {
        let out_file = File::create(&args.output)?;
        let writer = BufWriter::new(out_file);
        builder.build_hierarchical(writer, args.entries_per_leaf)?;
    }

    // Immediate cryptographic Merkle + Zstd integrity verification
    let verify_file = File::open(&args.output)?;
    let file_size = verify_file.metadata()?.len();
    let mut reader_check = PlasmidReader::new(BufReader::new(verify_file))?;
    if !reader_check.verify_integrity()? {
        return Err("ClinVar container Merkle verification failed after build".into());
    }

    println!(
        "✅ Packed ClinVar Zstd container '{}' (scanned={}, packed_variants={}, chroms={}, zstd_entries={}, raw_vcf={} KB -> container={} KB, merkle_verified=true)",
        args.output.display(),
        total_scanned,
        selected.len(),
        chrom_summary.len(),
        entry_blocks,
        raw_uncompressed_bytes / 1024,
        file_size / 1024,
    );

    Ok(())
}
