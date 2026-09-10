use plasmid_format::{EntryType, PlasmidDirectory, PlasmidIndexEntry, PlasmidReader};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Seek};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum PlasmidCoreError {
    #[error("Format error: {0}")]
    Format(#[from] plasmid_format::PlasmidFormatError),

    #[error("Unknown chromosome identifier: {0}")]
    UnknownChromosome(String),

    #[error("VCF parsing error: {0}")]
    VcfParse(String),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, PlasmidCoreError>;

/// Normalizes chromosome names to standard numeric IDs (1..=22, 23=X, 24=Y, 25=M).
pub fn chrom_to_id(name: &str) -> Result<u16> {
    let clean = name.trim_start_matches("chr").to_uppercase();
    match clean.as_str() {
        "X" => Ok(23),
        "Y" => Ok(24),
        "M" | "MT" => Ok(25),
        val => val
            .parse::<u16>()
            .map_err(|_| PlasmidCoreError::UnknownChromosome(name.to_string())),
    }
}

pub fn id_to_chrom(id: u16) -> String {
    match id {
        23 => "chrX".to_string(),
        24 => "chrY".to_string(),
        25 => "chrM".to_string(),
        n => format!("chr{n}"),
    }
}

/// HTTP Range representation for Cloudflare R2 / S3 requests.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ByteRange {
    pub start: u64,
    pub end: u64,
}

impl ByteRange {
    pub fn to_http_header(&self) -> String {
        format!("bytes={}-{}", self.start, self.end)
    }
}

/// Query plan describing exact byte ranges and 16KB Merkle chunks needed to satisfy a query.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlicingPlan {
    pub chrom_id: u16,
    pub start_pos: u64,
    pub end_pos: u64,
    pub chunk_indices: Vec<u32>,
    pub byte_ranges: Vec<ByteRange>,
    pub entries: Vec<PlasmidIndexEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VariantRecord {
    pub chrom: String,
    pub pos: u64,
    pub id: Option<String>,
    pub reference: String,
    pub alternate: String,
    pub info: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UnifiedGenomicSlice {
    pub chrom: String,
    pub start_pos: u64,
    pub end_pos: u64,
    pub variants: Vec<VariantRecord>,
    pub wiki_annotations: Vec<String>,
}

pub struct GenomicCoordinator;

impl GenomicCoordinator {
    /// Given a remote index, generates the minimal SlicingPlan needed.
    pub fn plan_slice(
        directory: &PlasmidDirectory,
        chrom_name: &str,
        start_pos: u64,
        end_pos: u64,
        payload_start_offset: u64,
        chunk_size: u32,
    ) -> Result<SlicingPlan> {
        let chrom_id = chrom_to_id(chrom_name)?;
        let entries = directory.query_range(chrom_id, start_pos, end_pos, None);

        let mut chunk_set = Vec::new();
        for entry in &entries {
            for c in 0..entry.chunk_count {
                chunk_set.push(entry.chunk_start + c);
            }
        }
        chunk_set.sort_unstable();
        chunk_set.dedup();

        // Convert chunk indices into contiguous byte ranges
        let mut byte_ranges = Vec::new();
        for &chunk_idx in &chunk_set {
            let start = payload_start_offset + (chunk_idx as u64 * chunk_size as u64);
            let end = start + chunk_size as u64 - 1;
            byte_ranges.push(ByteRange { start, end });
        }

        Ok(SlicingPlan {
            chrom_id,
            start_pos,
            end_pos,
            chunk_indices: chunk_set,
            byte_ranges,
            entries,
        })
    }

    /// Decodes payloads for matched entries into unified variants and annotations.
    pub fn decode_slice<R: Read + Seek>(
        reader: &mut PlasmidReader<R>,
        chrom_name: &str,
        start_pos: u64,
        end_pos: u64,
    ) -> Result<UnifiedGenomicSlice> {
        let chrom_id = chrom_to_id(chrom_name)?;
        let entries = reader.query(chrom_id, start_pos, end_pos, None);

        let mut variants = Vec::new();
        let mut wiki_annotations = Vec::new();

        for entry in entries {
            let payload = reader.read_entry_payload(&entry)?;
            match entry.entry_type {
                EntryType::VcfVariant => {
                    let text = String::from_utf8_lossy(&payload);
                    for line in text.lines() {
                        let line = line.trim();
                        if line.is_empty() || line.starts_with('#') {
                            continue;
                        }
                        let cols: Vec<&str> = line.split('\t').collect();
                        if cols.len() >= 5 {
                            let mut info_map = HashMap::new();
                            if cols.len() >= 8 {
                                for item in cols[7].split(';') {
                                    if let Some((k, v)) = item.split_once('=') {
                                        info_map.insert(k.to_string(), v.to_string());
                                    } else {
                                        info_map.insert(item.to_string(), "true".to_string());
                                    }
                                }
                            }

                            variants.push(VariantRecord {
                                chrom: cols[0].to_string(),
                                pos: cols[1].parse().unwrap_or(0),
                                id: if cols[2] != "." {
                                    Some(cols[2].to_string())
                                } else {
                                    None
                                },
                                reference: cols[3].to_string(),
                                alternate: cols[4].to_string(),
                                info: info_map,
                            });
                        }
                    }
                }
                EntryType::ClinVarAnnotation | EntryType::WikiMarkdown => {
                    wiki_annotations.push(String::from_utf8_lossy(&payload).to_string());
                }
                _ => {}
            }
        }

        Ok(UnifiedGenomicSlice {
            chrom: chrom_name.to_string(),
            start_pos,
            end_pos,
            variants,
            wiki_annotations,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use plasmid_format::PlasmidBuilder;
    use std::io::Cursor;

    #[test]
    fn test_slicing_plan_and_decode() {
        let mut builder = PlasmidBuilder::new("GRCh38");

        let braf_vcf = b"chr7\t140453136\trs113488022\tT\tA\t100\tPASS\tGENE=BRAF;CLNSIG=Pathogenic;AA=p.Val600Glu";
        builder.add_item(
            7,
            EntryType::VcfVariant,
            140453136,
            140453137,
            braf_vcf.to_vec(),
        );

        let braf_note = b"### BRAF V600E Mutation\nClinVar Pathogenic variant common in melanoma.";
        builder.add_item(
            7,
            EntryType::ClinVarAnnotation,
            140453100,
            140453200,
            braf_note.to_vec(),
        );

        let mut out = Vec::new();
        let header = builder.build(&mut out).unwrap();

        let cursor = Cursor::new(out);
        let mut reader = PlasmidReader::new(cursor).unwrap();

        // 1. Test planning
        let plan = GenomicCoordinator::plan_slice(
            &reader.directory,
            "chr7",
            140453136,
            140453136,
            header.metadata_offset + header.metadata_length,
            header.chunk_size,
        )
        .unwrap();

        assert_eq!(plan.chrom_id, 7);
        assert!(!plan.chunk_indices.is_empty());
        assert!(!plan.byte_ranges.is_empty());
        assert!(plan.byte_ranges[0].to_http_header().starts_with("bytes="));

        // 2. Test decode
        let decoded =
            GenomicCoordinator::decode_slice(&mut reader, "chr7", 140453136, 140453136).unwrap();
        assert_eq!(decoded.variants.len(), 1);
        assert_eq!(decoded.variants[0].pos, 140453136);
        assert_eq!(decoded.variants[0].id.as_deref(), Some("rs113488022"));
        assert_eq!(
            decoded.variants[0].info.get("CLNSIG").map(|s| s.as_str()),
            Some("Pathogenic")
        );
        assert_eq!(decoded.wiki_annotations.len(), 1);
        assert!(decoded.wiki_annotations[0].contains("BRAF V600E"));
    }
}
