use crate::chrom::{chrom_to_id, id_to_chrom};
use crate::decoder::{FastaDecoder, VcfDecoder, VcfVariantRecord};
use crate::error::{PlasmidCoreError, Result};
use crate::governance::SubmitterStarRating;
use crate::liftover::LiftoverEngine;
use crate::slicing::{ByteRange, RangePlanner, SlicingPlan, coalesce_byte_ranges};
use crate::wasm::{WasmChunkHashInfo, WasmLeafPointerInfo, WasmLeafQueryPlan, hex_encode};
use plasmid_format::{
    EntryType, PlasmidDirectory, PlasmidIndexEntry, PlasmidRootDirectory, decompress_payload,
    hash_leaf,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClinVarMatchedVariant {
    pub key: String,
    pub chrom: String,
    pub pos: u64,
    pub personal_pos: u64,
    pub lifted_from_build: Option<String>,
    pub rsid: String,
    pub variation_id: Option<String>,
    pub gene: Option<String>,
    pub reference: String,
    pub alternate: String,
    pub personal_genotype: String,
    pub zygosity: String,
    pub clinical_significance: String,
    pub significance_category: String,
    pub review_stars: u8,
    pub review_status: String,
    pub conditions: Vec<String>,
    pub molecular_consequence: Option<String>,
    pub hgvs: Option<String>,
    pub allele_frequency: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WasmIntersectionResult {
    pub personal_build: String,
    pub clinvar_build: String,
    pub total_personal_variants: usize,
    pub carrier_personal_variants: usize,
    pub lifted_variants_count: usize,
    pub clinvar_variants_scanned: usize,
    pub matched_count: usize,
    pub pathogenic_count: usize,
    pub likely_pathogenic_count: usize,
    pub drug_response_count: usize,
    pub risk_factor_count: usize,
    pub matches: Vec<ClinVarMatchedVariant>,
    pub chunk_hashes: Vec<WasmChunkHashInfo>,
}

#[derive(Debug, Clone)]
struct NormalizedPersonalQuery {
    chrom_id: u16,
    target_pos: u64,
    personal_pos: u64,
    lifted_from_build: Option<String>,
    strand_flipped: bool,
    rsid: Option<String>,
    raw_gt: String,
    is_23andme_bases: bool,
    vcf_ref: String,
    carried_vcf_alts: Vec<(String, &'static str)>, // (allele, zygosity)
}

fn is_grch37_build(build: &str) -> bool {
    let upper = build.to_ascii_uppercase();
    upper.contains("37") || upper.contains("19")
}

fn parse_vcf_genotype_alleles(
    raw_gt: Option<&str>,
    alt_field: &str,
) -> Option<(String, Vec<(String, &'static str)>)> {
    let alts: Vec<&str> = alt_field
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty() && *s != ".")
        .collect();
    if alts.is_empty() {
        return None;
    }

    let Some(gt_raw) = raw_gt.map(str::trim).filter(|g| !g.is_empty()) else {
        // Sites-only VCF without GT column: treat first listed ALT as observed
        return Some((
            "Observed".to_string(),
            vec![(alts[0].to_string(), "Observed")],
        ));
    };

    // Check 23andMe 1-or-2 letter base genotype (e.g., "GA", "AA", "T")
    if !gt_raw.contains('/')
        && !gt_raw.contains('|')
        && gt_raw
            .chars()
            .all(|c| matches!(c.to_ascii_uppercase(), 'A' | 'C' | 'G' | 'T' | 'I' | 'D'))
    {
        return Some((gt_raw.to_uppercase(), Vec::new()));
    }

    let tokens: Vec<&str> = gt_raw.split(['/', '|']).map(str::trim).collect();
    let mut parsed_indices: Vec<usize> = Vec::with_capacity(tokens.len());
    for tok in &tokens {
        if let Ok(idx) = tok.parse::<usize>() {
            parsed_indices.push(idx);
        }
    }

    if parsed_indices.is_empty() || parsed_indices.iter().all(|&idx| idx == 0) {
        // Homozygous reference (0/0, 0|0) or missing (./.) -> non-carrier
        return None;
    }

    let total_alleles = parsed_indices.len();
    let mut counts: HashMap<usize, usize> = HashMap::new();
    for &idx in &parsed_indices {
        if idx >= 1 {
            *counts.entry(idx).or_insert(0) += 1;
        }
    }

    let mut carried = Vec::new();
    for (allele_idx, copy_count) in counts {
        if let Some(&alt_seq) = alts.get(allele_idx - 1) {
            let zygosity = if total_alleles == 1 {
                "Hemizygous"
            } else if copy_count >= total_alleles {
                "HomozygousAlt"
            } else {
                "Heterozygous"
            };
            carried.push((alt_seq.to_string(), zygosity));
        }
    }

    if carried.is_empty() {
        None
    } else {
        Some((gt_raw.to_string(), carried))
    }
}

fn normalize_personal_variants(
    personal_variants: &[VcfVariantRecord],
    personal_build: &str,
    clinvar_build: &str,
) -> (Vec<NormalizedPersonalQuery>, usize, usize) {
    let personal_is_37 = is_grch37_build(personal_build);
    let clinvar_is_37 = is_grch37_build(clinvar_build);
    let needs_liftover = personal_is_37 != clinvar_is_37;
    let liftover = if needs_liftover {
        Some(LiftoverEngine::new_with_curated_regions())
    } else {
        None
    };

    let mut queries = Vec::with_capacity(personal_variants.len());
    let mut carrier_count = 0usize;
    let mut lifted_count = 0usize;

    for pv in personal_variants {
        let Ok(chrom_id) = chrom_to_id(&pv.chrom) else {
            continue;
        };

        let raw_gt_opt = pv.info.get("GT").map(String::as_str);
        let Some((gt_display, carried_vcf_alts)) =
            parse_vcf_genotype_alleles(raw_gt_opt, &pv.alternate)
        else {
            continue;
        };
        let is_23andme_bases = carried_vcf_alts.is_empty();
        carrier_count += 1;

        let mut target_pos = pv.pos;
        let mut lifted_from_build = None;
        let mut strand_flipped = false;

        if let Some(engine) = &liftover {
            let lifted_res = if personal_is_37 {
                engine.lift_hg19_to_hg38(&pv.chrom, pv.pos, &pv.reference)
            } else {
                engine.lift_hg38_to_hg19(&pv.chrom, pv.pos, &pv.reference)
            };

            match lifted_res {
                Ok(lifted) => {
                    target_pos = lifted.lifted_pos;
                    strand_flipped = !lifted.ref_allele.eq_ignore_ascii_case(&pv.reference);
                    lifted_from_build = Some(if personal_is_37 {
                        "GRCh37".to_string()
                    } else {
                        "GRCh38".to_string()
                    });
                    lifted_count += 1;
                }
                Err(_) => continue,
            }
        }

        let rsid = pv
            .id
            .as_deref()
            .filter(|id| id.starts_with("rs"))
            .map(|s| s.to_ascii_lowercase());

        queries.push(NormalizedPersonalQuery {
            chrom_id,
            target_pos,
            personal_pos: pv.pos,
            lifted_from_build,
            strand_flipped,
            rsid,
            raw_gt: gt_display,
            is_23andme_bases,
            vcf_ref: pv.reference.clone(),
            carried_vcf_alts,
        });
    }

    (queries, carrier_count, lifted_count)
}

/// Plans minimal Leaf Directory HTTP Range requests needed to intersect a personal dataset against a hierarchical ClinVar `.plasmid` pack.
pub fn plan_intersection_leaves_dto(
    root_dir_bytes: &[u8],
    personal_variants: &[VcfVariantRecord],
    personal_build: &str,
    clinvar_build: &str,
) -> Result<WasmLeafQueryPlan> {
    let root = PlasmidRootDirectory::deserialize(root_dir_bytes)?;
    let (queries, _, _) =
        normalize_personal_variants(personal_variants, personal_build, clinvar_build);

    // Group sorted personal target coordinates by chromosome
    let mut coords_by_chrom: HashMap<u16, Vec<u64>> = HashMap::new();
    for q in &queries {
        coords_by_chrom
            .entry(q.chrom_id)
            .or_default()
            .push(q.target_pos);
    }
    for coords in coords_by_chrom.values_mut() {
        coords.sort_unstable();
        coords.dedup();
    }

    let mut matched_leaves = Vec::new();
    for leaf in &root.leaves {
        let Some(coords) = coords_by_chrom.get(&leaf.chrom_id) else {
            continue;
        };
        // Binary search whether any personal coordinate falls inside [leaf.min_pos - 2, leaf.max_pos + 2]
        let lo = leaf.min_pos.saturating_sub(2);
        let hi = leaf.max_pos.saturating_add(2);
        let idx = coords.partition_point(|&p| p < lo);
        if idx < coords.len() && coords[idx] <= hi {
            matched_leaves.push(*leaf);
        }
    }

    let raw_ranges: Vec<ByteRange> = matched_leaves
        .iter()
        .filter(|l| l.leaf_length > 0)
        .map(|l| ByteRange::new(l.leaf_offset, l.leaf_offset + l.leaf_length as u64 - 1))
        .collect();
    let byte_ranges = coalesce_byte_ranges(raw_ranges, 0);

    Ok(WasmLeafQueryPlan {
        chrom_id: 0,
        leaves: matched_leaves
            .into_iter()
            .map(WasmLeafPointerInfo::from)
            .collect(),
        byte_ranges,
    })
}

/// Plans minimal 16KB Merkle chunk HTTP Range requests across one or more chromosomes from downloaded directory entries.
pub fn plan_intersection_chunks_dto(
    directory_bytes: &[u8],
    personal_variants: &[VcfVariantRecord],
    personal_build: &str,
    clinvar_build: &str,
    payload_offset: u64,
    chunk_size: u32,
) -> Result<SlicingPlan> {
    let dir = PlasmidDirectory::deserialize(directory_bytes)?;
    let (queries, _, _) =
        normalize_personal_variants(personal_variants, personal_build, clinvar_build);

    let mut coords_by_chrom: HashMap<u16, Vec<u64>> = HashMap::new();
    for q in &queries {
        coords_by_chrom
            .entry(q.chrom_id)
            .or_default()
            .push(q.target_pos);
    }
    for coords in coords_by_chrom.values_mut() {
        coords.sort_unstable();
        coords.dedup();
    }

    let mut matched_entries = Vec::new();
    for entry in &dir.entries {
        if entry.entry_type != EntryType::VcfVariant {
            continue;
        }
        let Some(coords) = coords_by_chrom.get(&entry.chrom_id) else {
            continue;
        };
        let lo = entry.start_pos.saturating_sub(2);
        let hi = entry.end_pos.saturating_add(2);
        let idx = coords.partition_point(|&p| p < lo);
        if idx < coords.len() && coords[idx] <= hi {
            matched_entries.push(*entry);
        }
    }

    RangePlanner::plan_from_entries(&matched_entries, 0, 0, 0, payload_offset, chunk_size)
}

fn categorize_significance(sig: &str, conditions: &[String]) -> Option<(&'static str, u8)> {
    let lower = sig.to_ascii_lowercase();
    let no_conflict_benign = !lower.contains("conflict") && !lower.contains("benign");

    if no_conflict_benign && lower.contains("pathogenic") {
        let has_pure_pathogenic = lower
            .split(['|', '/', ',', ';'])
            .map(str::trim)
            .any(|part| part == "pathogenic");
        if has_pure_pathogenic {
            return Some(("pathogenic", 0));
        }
        return Some(("likely_pathogenic", 1));
    }
    if no_conflict_benign && (lower.contains("oncogenic") || lower.contains("tier_i")) {
        return Some(("oncogenic", 2));
    }
    let has_pharmaco_condition = conditions.iter().any(|c| {
        let cl = c.to_ascii_lowercase();
        cl.contains("response") || cl.contains("metabolism") || cl.contains("sensitivity")
    });
    if lower.contains("drug_response")
        || lower.contains("drug response")
        || (lower.contains("other") && has_pharmaco_condition)
    {
        return Some(("drug_response", 3));
    }
    if lower.contains("risk_factor") || lower.contains("risk factor") {
        return Some(("risk_factor", 4));
    }
    // Exclude purely Benign / Likely_benign / Uncertain_significance noise from clinical actionability matches
    if lower.contains("benign") || lower.contains("uncertain") || lower.contains("conflict") {
        return None;
    }
    Some(("other", 5))
}

fn parse_conditions(info: &HashMap<String, String>) -> Vec<String> {
    let raw = info
        .get("CLNDN")
        .or_else(|| info.get("ONCDN"))
        .or_else(|| info.get("SCIDN"));
    let Some(raw_str) = raw else {
        return Vec::new();
    };

    let mut out = Vec::new();
    for part in raw_str.split('|') {
        let clean = part.replace('_', " ").trim().to_string();
        let lower = clean.to_ascii_lowercase();
        if clean.is_empty()
            || lower == "not provided"
            || lower == "not specified"
            || lower == "see cases"
            || out.contains(&clean)
        {
            continue;
        }
        out.push(clean);
    }
    out
}

fn parse_molecular_consequence(info: &HashMap<String, String>) -> Option<String> {
    let mc = info.get("MC")?;
    let first = mc.split(',').next()?.trim();
    let label = first.split('|').nth(1).unwrap_or(first).replace('_', " ");
    if label.is_empty() { None } else { Some(label) }
}

fn parse_allele_frequency(info: &HashMap<String, String>) -> Option<f64> {
    for key in ["AF_TGP", "AF_EXAC", "AF_ESP", "AF"] {
        if let Some(val) = info.get(key)
            && let Ok(parsed) = val.parse::<f64>()
        {
            return Some(parsed);
        }
    }
    None
}

fn match_personal_to_clinvar(
    q: &NormalizedPersonalQuery,
    cv: &VcfVariantRecord,
) -> Option<&'static str> {
    if q.is_23andme_bases {
        // 23andMe 1-or-2 base genotype string (e.g., "GA", "AA", "AT")
        let gt_oriented = if q.strand_flipped {
            FastaDecoder::reverse_complement(&q.raw_gt)
        } else {
            q.raw_gt.clone()
        };

        if cv.reference.len() == 1 && cv.alternate.len() == 1 {
            let alt_char = cv.alternate.chars().next()?.to_ascii_uppercase();
            let ref_char = cv.reference.chars().next()?.to_ascii_uppercase();
            let alleles: Vec<char> = gt_oriented.chars().collect();
            let alt_copies = alleles.iter().filter(|&&c| c == alt_char).count();
            if alt_copies == 0 {
                return None;
            }
            // Ensure remaining bases are compatible with ref or alt
            if !alleles.iter().all(|&c| c == alt_char || c == ref_char) {
                return None;
            }
            return Some(if alleles.len() == 1 {
                "Hemizygous"
            } else if alt_copies >= alleles.len() {
                "HomozygousAlt"
            } else {
                "Heterozygous"
            });
        }

        // Indel in 23andMe ('I' = insertion, 'D' = deletion) matched at exact pos or rsID
        let is_insertion = cv.alternate.len() > cv.reference.len();
        let is_deletion = cv.alternate.len() < cv.reference.len();
        let target_marker = if is_insertion {
            'I'
        } else if is_deletion {
            'D'
        } else {
            return None;
        };
        let alleles: Vec<char> = q.raw_gt.chars().collect();
        let alt_copies = alleles.iter().filter(|&&c| c == target_marker).count();
        if alt_copies == 0 {
            return None;
        }
        return Some(if alleles.len() == 1 {
            "Hemizygous"
        } else if alt_copies >= alleles.len() {
            "HomozygousAlt"
        } else {
            "Heterozygous"
        });
    }

    // Standard VCF: compare oriented REF & carried ALT allele(s)
    let oriented_ref = if q.strand_flipped {
        FastaDecoder::reverse_complement(&q.vcf_ref)
    } else {
        q.vcf_ref.clone()
    };

    if !oriented_ref.eq_ignore_ascii_case(&cv.reference) {
        return None;
    }

    for (alt_seq, zygosity) in &q.carried_vcf_alts {
        let oriented_alt = if q.strand_flipped {
            FastaDecoder::reverse_complement(alt_seq)
        } else {
            alt_seq.clone()
        };
        if oriented_alt.eq_ignore_ascii_case(&cv.alternate) {
            return Some(zygosity);
        }
    }

    None
}

/// Decompresses sliced Zstd/BGZF/Raw ClinVar `.plasmid` chunks, verifies SHA-256 digests,
/// and intersects them against a local personal variant dataset entirely inside Rust/WASM.
pub fn intersect_personal_with_clinvar_dto(
    personal_variants: &[VcfVariantRecord],
    personal_build: &str,
    clinvar_entries: &[PlasmidIndexEntry],
    chunks_concat: &[u8],
    chunk_indices: &[u32],
    chunk_size: u32,
    clinvar_build: &str,
) -> Result<WasmIntersectionResult> {
    if chunk_size == 0 {
        return Err(PlasmidCoreError::Serialization(
            "chunk_size must be greater than zero".to_string(),
        ));
    }

    let csize = chunk_size as usize;
    let expected_len = chunk_indices.len().saturating_mul(csize);
    if chunks_concat.len() != expected_len {
        return Err(PlasmidCoreError::Serialization(format!(
            "Chunk buffer size mismatch: expected {} bytes for {} chunks of {}B, found {} bytes",
            expected_len,
            chunk_indices.len(),
            csize,
            chunks_concat.len()
        )));
    }

    let mut chunk_map: HashMap<u32, &[u8]> = HashMap::with_capacity(chunk_indices.len());
    let mut chunk_hashes = Vec::with_capacity(chunk_indices.len());

    for (pos_idx, &chunk_idx) in chunk_indices.iter().enumerate() {
        let start = pos_idx * csize;
        let slice = &chunks_concat[start..start + csize];
        let digest = hash_leaf(slice);
        chunk_hashes.push(WasmChunkHashInfo {
            chunk_index: chunk_idx,
            byte_length: slice.len(),
            sha256_hex: hex_encode(&digest),
        });
        chunk_map.insert(chunk_idx, slice);
    }

    let mut by_coord: HashMap<(u16, u64), Vec<VcfVariantRecord>> = HashMap::new();
    let mut by_rsid: HashMap<(u16, String), Vec<VcfVariantRecord>> = HashMap::new();
    let mut clinvar_variants_scanned = 0usize;

    for entry in clinvar_entries {
        if entry.entry_type != EntryType::VcfVariant {
            continue;
        }
        let mut combined = Vec::with_capacity((entry.chunk_count as usize) * csize);
        for c in 0..entry.chunk_count {
            let target_idx = entry.chunk_start + c;
            let chunk_bytes = chunk_map.get(&target_idx).ok_or_else(|| {
                PlasmidCoreError::Serialization(format!(
                    "Missing required chunk #{target_idx} for ClinVar entry at {}:{}",
                    id_to_chrom(entry.chrom_id),
                    entry.start_pos
                ))
            })?;
            combined.extend_from_slice(chunk_bytes);
        }
        combined.truncate(entry.payload_bytes as usize);
        let decompressed = decompress_payload(entry.codec()?, &combined)?;
        let decoded = VcfDecoder::decode_slice(&decompressed)?;

        for rec in decoded {
            let cid = chrom_to_id(&rec.chrom).unwrap_or(entry.chrom_id);
            clinvar_variants_scanned += 1;
            if let Some(id_str) = rec.id.as_deref()
                && id_str.starts_with("rs")
            {
                by_rsid
                    .entry((cid, id_str.to_ascii_lowercase()))
                    .or_default()
                    .push(rec.clone());
            }
            by_coord.entry((cid, rec.pos)).or_default().push(rec);
        }
    }

    let (queries, carrier_personal_variants, lifted_variants_count) =
        normalize_personal_variants(personal_variants, personal_build, clinvar_build);

    let mut seen_keys: HashSet<String> = HashSet::new();
    let mut matches_with_rank: Vec<(u8, ClinVarMatchedVariant)> = Vec::new();

    for q in &queries {
        let mut candidates: Vec<&VcfVariantRecord> = Vec::new();
        if let Some(at_pos) = by_coord.get(&(q.chrom_id, q.target_pos)) {
            candidates.extend(at_pos.iter());
        }
        if candidates.is_empty()
            && let Some(rsid) = &q.rsid
            && let Some(by_id) = by_rsid.get(&(q.chrom_id, rsid.clone()))
        {
            for cand in by_id {
                if cand.pos.abs_diff(q.target_pos) <= 5 {
                    candidates.push(cand);
                }
            }
        }

        for cv in candidates {
            let Some(zygosity) = match_personal_to_clinvar(q, cv) else {
                continue;
            };

            let key = format!("{}:{}:{}:{}", cv.chrom, cv.pos, cv.reference, cv.alternate);
            if !seen_keys.insert(key.clone()) {
                continue;
            }

            let clnsig = cv
                .clinvar_significance
                .clone()
                .unwrap_or_else(|| "Unclassified".to_string());
            let conditions = parse_conditions(&cv.info);
            let Some((cat_name, cat_rank)) = categorize_significance(&clnsig, &conditions) else {
                continue;
            };

            let rev_raw = cv
                .info
                .get("CLNREVSTAT")
                .or_else(|| cv.info.get("ONCREVSTAT"))
                .map(String::as_str)
                .unwrap_or("");
            let star_info = SubmitterStarRating::from_review_status(rev_raw);
            let molecular_consequence = parse_molecular_consequence(&cv.info);
            let allele_frequency = parse_allele_frequency(&cv.info);
            let variation_id = cv.info.get("VARIATION_ID").cloned();
            let rsid = cv.id.clone().unwrap_or_else(|| ".".to_string());

            matches_with_rank.push((
                cat_rank,
                ClinVarMatchedVariant {
                    key,
                    chrom: cv.chrom.clone(),
                    pos: cv.pos,
                    personal_pos: q.personal_pos,
                    lifted_from_build: q.lifted_from_build.clone(),
                    rsid,
                    variation_id,
                    gene: cv.gene.clone(),
                    reference: cv.reference.clone(),
                    alternate: cv.alternate.clone(),
                    personal_genotype: q.raw_gt.clone(),
                    zygosity: zygosity.to_string(),
                    clinical_significance: clnsig,
                    significance_category: cat_name.to_string(),
                    review_stars: star_info.stars,
                    review_status: star_info.label,
                    conditions,
                    molecular_consequence,
                    hgvs: cv.amino_acid_change.clone(),
                    allele_frequency,
                },
            ));
        }
    }

    matches_with_rank.sort_by(|(rank_a, a), (rank_b, b)| {
        rank_a
            .cmp(rank_b)
            .then_with(|| b.review_stars.cmp(&a.review_stars))
            .then_with(|| {
                let ca = chrom_to_id(&a.chrom).unwrap_or(u16::MAX);
                let cb = chrom_to_id(&b.chrom).unwrap_or(u16::MAX);
                ca.cmp(&cb)
            })
            .then_with(|| a.pos.cmp(&b.pos))
    });

    let mut pathogenic_count = 0usize;
    let mut likely_pathogenic_count = 0usize;
    let mut drug_response_count = 0usize;
    let mut risk_factor_count = 0usize;

    let mut matches = Vec::with_capacity(matches_with_rank.len());
    for (_, m) in matches_with_rank {
        match m.significance_category.as_str() {
            "pathogenic" | "oncogenic" => pathogenic_count += 1,
            "likely_pathogenic" => likely_pathogenic_count += 1,
            "drug_response" => drug_response_count += 1,
            "risk_factor" => risk_factor_count += 1,
            _ => {}
        }
        matches.push(m);
    }

    Ok(WasmIntersectionResult {
        personal_build: personal_build.to_string(),
        clinvar_build: clinvar_build.to_string(),
        total_personal_variants: personal_variants.len(),
        carrier_personal_variants,
        lifted_variants_count,
        clinvar_variants_scanned,
        matched_count: matches.len(),
        pathogenic_count,
        likely_pathogenic_count,
        drug_response_count,
        risk_factor_count,
        matches,
        chunk_hashes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use plasmid_format::{CompressionCodec, PlasmidBuilder};

    #[test]
    fn test_zstd_clinvar_intersection_vcf_and_23andme_with_hg19_liftover() {
        let mut builder = PlasmidBuilder::new("GRCh38");
        builder.set_compression(CompressionCodec::Zstd);

        // Real ClinVar records across chr6, chr11, chr19
        builder.add_item(
            6,
            EntryType::VcfVariant,
            26_092_913,
            26_092_913,
            b"6\t26092913\t9\tG\tA\t.\t.\tCLNDN=Hereditary_hemochromatosis;CLNREVSTAT=reviewed_by_expert_panel;CLNSIG=Pathogenic;GENEINFO=HFE:3077;MC=SO:0001583|missense_variant;RS=1800562\n".to_vec(),
        );
        builder.add_item(
            11,
            EntryType::VcfVariant,
            5_227_002,
            5_227_002,
            b"11\t5227002\t15333\tT\tA\t.\t.\tCLNDN=Sickle_cell_disease;CLNREVSTAT=criteria_provided,_multiple_submitters,_no_conflicts;CLNSIG=Pathogenic;GENEINFO=HBB:3043;RS=334\n".to_vec(),
        );
        builder.add_item(
            19,
            EntryType::VcfVariant,
            44_908_822,
            44_908_822,
            b"19\t44908822\t17848\tC\tT\t.\t.\tCLNDN=Hyperlipoproteinemia_type_III;CLNREVSTAT=practice_guideline;CLNSIG=drug_response;GENEINFO=APOE:348;RS=7412\n".to_vec(),
        );

        let mut container = Vec::new();
        builder.build_hierarchical(&mut container, 1).unwrap();
        let header = crate::wasm::parse_header_dto(&container[0..128]).unwrap();
        let root_slice = &container
            [header.index_offset as usize..(header.index_offset + header.index_length) as usize];

        // 1. Personal 23andMe GRCh37 (hg19!) file with:
        //    - rs1800562 (chr6:26093141 hg19 -> 26092913 hg38) GA (Het carrier!)
        //    - rs334 (chr11:5248232 hg19 -> 5227002 hg38) TT (Wild-type Hom-Ref! Must NOT match!)
        //    - rs7412 (chr19:45412079 hg19 -> 44908822 hg38) TT (Hom-Alt!)
        let raw_23andme = concat!(
            "# This file generated by 23andMe build 37\n",
            "# rsid\tchromosome\tposition\tgenotype\n",
            "rs1800562\t6\t26093141\tGA\n",
            "rs334\t11\t5248232\tTT\n",
            "rs7412\t19\t45412079\tTT\n"
        );
        let personal_ds =
            crate::wasm::parse_vcf_dataset_dto(raw_23andme.as_bytes(), "GRCh38").unwrap();
        assert_eq!(personal_ds.reference_build, "GRCh37");

        let leaf_plan = plan_intersection_leaves_dto(
            root_slice,
            &personal_ds.variants,
            &personal_ds.reference_build,
            "GRCh38",
        )
        .unwrap();
        assert_eq!(leaf_plan.leaves.len(), 3);

        let mut concat_leaves = Vec::new();
        for l in &leaf_plan.leaves {
            concat_leaves.extend_from_slice(
                &container[l.leaf_offset as usize..(l.leaf_offset + l.leaf_length as u64) as usize],
            );
        }

        let chunk_plan = plan_intersection_chunks_dto(
            &concat_leaves,
            &personal_ds.variants,
            &personal_ds.reference_build,
            "GRCh38",
            header.payload_offset,
            header.chunk_size,
        )
        .unwrap();
        assert_eq!(chunk_plan.chunk_indices.len(), 3);

        let mut chunks_buf = Vec::new();
        for &cidx in &chunk_plan.chunk_indices {
            let start =
                header.payload_offset as usize + (cidx as usize * header.chunk_size as usize);
            chunks_buf.extend_from_slice(&container[start..start + header.chunk_size as usize]);
        }

        let report = intersect_personal_with_clinvar_dto(
            &personal_ds.variants,
            &personal_ds.reference_build,
            &chunk_plan.entries,
            &chunks_buf,
            &chunk_plan.chunk_indices,
            header.chunk_size,
            "GRCh38",
        )
        .unwrap();

        // rs334 TT is wild-type reference, so ONLY rs1800562 (Het) and rs7412 (HomAlt) must match!
        assert_eq!(report.matched_count, 2);
        assert_eq!(report.pathogenic_count, 1);
        assert_eq!(report.drug_response_count, 1);
        assert_eq!(report.lifted_variants_count, 3);

        assert_eq!(report.matches[0].gene.as_deref(), Some("HFE"));
        assert_eq!(report.matches[0].rsid, "rs1800562");
        assert_eq!(report.matches[0].zygosity, "Heterozygous");
        assert_eq!(report.matches[0].review_stars, 3);
        assert_eq!(
            report.matches[0].conditions,
            vec!["Hereditary hemochromatosis"]
        );

        assert_eq!(report.matches[1].gene.as_deref(), Some("APOE"));
        assert_eq!(report.matches[1].rsid, "rs7412");
        assert_eq!(report.matches[1].zygosity, "HomozygousAlt");
        assert_eq!(report.matches[1].review_stars, 4);
    }
}
