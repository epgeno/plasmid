use clap::Args;
use plasmid_core::chrom::{chrom_to_id, id_to_chrom};
use plasmid_format::{DEFAULT_CHUNK_SIZE, EntryType, PlasmidBuilder};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter};
use std::path::{Path, PathBuf};

#[derive(Args, Debug)]
pub struct BuildArgs {
    /// Path to input VCF file
    #[arg(long)]
    pub vcf: Option<PathBuf>,

    /// Path to input FASTA reference file
    #[arg(long)]
    pub fasta: Option<PathBuf>,

    /// Path to input annotations (Markdown/ClinVar notes) file
    #[arg(long)]
    pub annotation: Option<PathBuf>,

    /// Output .plasmid container path
    #[arg(short, long)]
    pub output: PathBuf,

    /// Reference genome build (e.g. GRCh38, GRCh37)
    #[arg(short, long, default_value = "GRCh38")]
    pub reference: String,

    /// Build with PMTiles v3 style 2-stage hierarchical leaf directory
    #[arg(long, default_value_t = false)]
    pub hierarchical: bool,

    /// Maximum index entries per leaf directory block in hierarchical mode
    #[arg(long, default_value_t = 64)]
    pub entries_per_leaf: usize,

    /// Custom metadata JSON string or path to JSON file
    #[arg(long)]
    pub metadata: Option<String>,
}

struct PendingVcfRecord {
    chrom_id: u16,
    pos: u64,
    end_pos: u64,
    line_bytes: Vec<u8>,
}

pub fn execute(args: BuildArgs) -> Result<(), Box<dyn std::error::Error>> {
    println!("📦 Compiling .plasmid genomic archive...");
    println!("   Reference Build: {}", args.reference);
    println!("   Output File:     {}", args.output.display());

    let mut builder = PlasmidBuilder::new(&args.reference);
    let mut pyramid = plasmid_core::pyramid::PyramidIndex::new(&args.reference);

    // 1. Process Metadata
    let meta_str = if let Some(m) = &args.metadata {
        if Path::new(m).is_file() {
            fs::read_to_string(m)?
        } else {
            m.clone()
        }
    } else {
        serde_json::json!({
            "generator": "plasmid-cli v0.1.0",
            "created_at": "2026-09-12T00:00:00Z",
            "license": "Public Domain / CC0",
            "reference_build": args.reference,
        })
        .to_string()
    };
    builder.set_metadata(&meta_str);

    let mut vcf_count = 0usize;
    let mut vcf_block_count = 0usize;
    let mut fasta_count = 0usize;
    let mut annotation_count = 0usize;

    // 2. Parse VCF and pack records into 16KB chromosome-scoped batches with newline delimiters
    if let Some(vcf_path) = &args.vcf {
        println!("   Loading VCF from: {}", vcf_path.display());
        let file = File::open(vcf_path)?;
        let reader = BufReader::new(file);
        let mut pending_vcf = Vec::new();

        for line_res in reader.lines() {
            let line = line_res?;
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            let parts: Vec<&str> = trimmed.split('\t').collect();
            if parts.len() < 5 {
                continue;
            }

            let chrom_str = parts[0];
            let pos: u64 = parts[1].parse().unwrap_or(0);
            if pos == 0 {
                continue;
            }

            let chrom_id = match chrom_to_id(chrom_str) {
                Ok(id) => id,
                Err(_) => continue,
            };

            let ref_seq = parts[3];
            let end_pos = pos + (ref_seq.len().max(1) as u64) - 1;

            if let Ok(variants) =
                plasmid_core::decoder::VcfDecoder::decode_slice(trimmed.as_bytes())
            {
                for v in &variants {
                    pyramid.ingest_variant(chrom_str, v);
                }
            }

            let mut line_bytes = Vec::with_capacity(trimmed.len() + 1);
            line_bytes.extend_from_slice(trimmed.as_bytes());
            line_bytes.push(b'\n');

            pending_vcf.push(PendingVcfRecord {
                chrom_id,
                pos,
                end_pos,
                line_bytes,
            });
            vcf_count += 1;
        }

        // Sort stably by (chrom_id, pos) so packed chunk coordinate bounds remain tight
        pending_vcf.sort_by_key(|r| (r.chrom_id, r.pos));

        let chunk_budget = DEFAULT_CHUNK_SIZE as usize;
        let mut batch_chrom: Option<u16> = None;
        let mut batch_start = 0u64;
        let mut batch_end = 0u64;
        let mut batch_buf: Vec<u8> = Vec::new();

        for rec in pending_vcf {
            let should_flush = match batch_chrom {
                Some(cid) => {
                    cid != rec.chrom_id
                        || (!batch_buf.is_empty()
                            && batch_buf.len() + rec.line_bytes.len() > chunk_budget)
                }
                None => false,
            };

            if should_flush {
                if let Some(cid) = batch_chrom {
                    builder.add_item(
                        cid,
                        EntryType::VcfVariant,
                        batch_start,
                        batch_end,
                        std::mem::take(&mut batch_buf),
                    );
                    vcf_block_count += 1;
                }
                batch_chrom = None;
            }

            if batch_chrom.is_none() {
                batch_chrom = Some(rec.chrom_id);
                batch_start = rec.pos;
                batch_end = rec.end_pos;
            } else {
                batch_start = batch_start.min(rec.pos);
                batch_end = batch_end.max(rec.end_pos);
            }
            batch_buf.extend_from_slice(&rec.line_bytes);
        }

        if let (Some(cid), false) = (batch_chrom, batch_buf.is_empty()) {
            builder.add_item(
                cid,
                EntryType::VcfVariant,
                batch_start,
                batch_end,
                batch_buf,
            );
            vcf_block_count += 1;
        }

        println!(
            "   ↳ Ingested {} variant records ({} packed blocks)",
            vcf_count, vcf_block_count
        );
    }

    // 3. Parse FASTA
    if let Some(fasta_path) = &args.fasta {
        println!("   Loading FASTA from: {}", fasta_path.display());
        let file = File::open(fasta_path)?;
        let reader = BufReader::new(file);

        let mut current_chrom: Option<u16> = None;
        let mut current_seq = String::new();
        let mut current_pos = 1u64;

        for line_res in reader.lines() {
            let line = line_res?;
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            if let Some(stripped) = trimmed.strip_prefix('>') {
                // Flush previous contig segment if any
                if let (Some(cid), false) = (current_chrom, current_seq.is_empty()) {
                    let end_pos = current_pos + current_seq.len() as u64 - 1;
                    let payload = format!(">{}\n{}\n", id_to_chrom(cid), current_seq);
                    builder.add_item(
                        cid,
                        EntryType::ReferenceFasta,
                        current_pos,
                        end_pos,
                        payload.into_bytes(),
                    );
                    fasta_count += 1;
                    current_seq.clear();
                }

                let header_part = stripped.split_whitespace().next().unwrap_or("");
                current_chrom = chrom_to_id(header_part).ok();
                current_pos = 1;
            } else if let Some(cid) = current_chrom {
                current_seq.push_str(trimmed);
                let chrom_label = id_to_chrom(cid);
                // Reserve exact header + newline overhead (">{chrom}\n" + "\n") so each payload fits inside one 16KB Merkle leaf
                let max_seq_len = (DEFAULT_CHUNK_SIZE as usize)
                    .saturating_sub(chrom_label.len() + 3)
                    .max(1);

                while current_seq.len() >= max_seq_len {
                    let chunk_seq: String = current_seq.drain(..max_seq_len).collect();
                    let end_pos = current_pos + chunk_seq.len() as u64 - 1;
                    let payload = format!(">{chrom_label}\n{chunk_seq}\n");
                    builder.add_item(
                        cid,
                        EntryType::ReferenceFasta,
                        current_pos,
                        end_pos,
                        payload.into_bytes(),
                    );
                    fasta_count += 1;
                    current_pos = end_pos + 1;
                }
            }
        }

        if let (Some(cid), false) = (current_chrom, current_seq.is_empty()) {
            let end_pos = current_pos + current_seq.len() as u64 - 1;
            let payload = format!(">{}\n{}\n", id_to_chrom(cid), current_seq);
            builder.add_item(
                cid,
                EntryType::ReferenceFasta,
                current_pos,
                end_pos,
                payload.into_bytes(),
            );
            fasta_count += 1;
        }
        println!("   ↳ Ingested {} reference sequence blocks", fasta_count);
    }

    // 4. Parse Annotations
    if let Some(ann_path) = &args.annotation {
        println!("   Loading Annotations from: {}", ann_path.display());
        let content = fs::read_to_string(ann_path)?;
        // Parse markdown sections delimited by `##`
        for section in content.split("\n##") {
            let trimmed = section.trim();
            if trimmed.is_empty() {
                continue;
            }
            let first_line = trimmed.lines().next().unwrap_or("");
            let clean_line = first_line.trim_start_matches('#').trim();
            let tokens: Vec<&str> = clean_line.split_whitespace().collect();
            if let Some(coord_part) = tokens.first() {
                let parsed_coord = (|| -> Option<(u16, u64, u64)> {
                    let (chr_str, range_str) = coord_part.split_once(':')?;
                    let (s_str, e_str) = range_str.split_once('-')?;
                    let cid = chrom_to_id(chr_str).ok()?;
                    let s = s_str.parse::<u64>().ok()?;
                    let e = e_str.parse::<u64>().ok()?;
                    Some((cid, s, e))
                })();

                if let Some((cid, s, e)) = parsed_coord {
                    let mut note = if trimmed.starts_with('#') {
                        trimmed.to_string()
                    } else {
                        format!("## {}", trimmed)
                    };
                    if !note.ends_with('\n') {
                        note.push('\n');
                    }
                    // RFC-0003 governance validation on annotation payload
                    plasmid_core::governance::DataGovernanceGuard::validate_annotation_payload(
                        &note,
                    )?;
                    builder.add_item(cid, EntryType::ClinVarAnnotation, s, e, note.into_bytes());
                    annotation_count += 1;
                }
            }
        }
        println!("   ↳ Ingested {} annotation notes", annotation_count);
    }

    let total_items = vcf_count + fasta_count + annotation_count;
    if total_items == 0 {
        eprintln!("⚠️  Warning: No input data provided. Building container with empty payload.");
    }

    // Embed multi-scale pyramid index into metadata
    let mut meta_val: serde_json::Value =
        serde_json::from_str(&meta_str).unwrap_or(serde_json::json!({}));
    if let Ok(pyr_val) = serde_json::to_value(&pyramid) {
        meta_val["pyramid"] = pyr_val;
    }
    builder.set_metadata(&meta_val.to_string());

    // Create parent directories if missing
    if let Some(parent) = args.output.parent() {
        fs::create_dir_all(parent)?;
    }

    let out_file = File::create(&args.output)?;
    let writer = BufWriter::new(out_file);

    let header = if args.hierarchical {
        println!(
            "   Generating 2-stage hierarchical leaf directory ({} entries/leaf)...",
            args.entries_per_leaf
        );
        builder.build_hierarchical(writer, args.entries_per_leaf)?
    } else {
        println!("   Generating standard flat directory index...");
        builder.build(writer)?
    };

    let file_meta = fs::metadata(&args.output)?;
    let root_hex = hex_encode(&header.root_hash);

    println!("\n✅ Successfully generated .plasmid archive!");
    println!("   File:            {}", args.output.display());
    println!(
        "   File Size:       {} bytes ({:.2} KB)",
        file_meta.len(),
        file_meta.len() as f64 / 1024.0
    );
    println!("   Total Chunks:    {} (16 KB each)", header.total_chunks);
    println!("   Root Merkle:     {}", root_hex);
    println!(
        "   Index Offset:    {} ({} bytes)",
        header.index_offset, header.index_length
    );
    println!(
        "   Metadata Offset: {} ({} bytes)",
        header.metadata_offset, header.metadata_length
    );

    Ok(())
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
