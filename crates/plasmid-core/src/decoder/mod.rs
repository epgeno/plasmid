pub mod annotation;
pub mod fasta;
pub mod vcf;

pub use annotation::{AnnotationDecoder, AnnotationRecord};
pub use fasta::{FastaDecoder, FastaRecord};
pub use vcf::{VcfDecoder, VcfVariantRecord};

use crate::chrom::chrom_to_id;
use crate::error::Result;
use plasmid_format::{EntryType, PlasmidIndexEntry, PlasmidReader};
use serde::{Deserialize, Serialize};
use std::io::{Read, Seek};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DecodeStats {
    pub variants_count: usize,
    pub annotations_count: usize,
    pub total_bytes_processed: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UnifiedGenomicSlice {
    pub chrom: String,
    pub start_pos: u64,
    pub end_pos: u64,
    pub variants: Vec<VcfVariantRecord>,
    pub reference_sequence: Option<String>,
    pub annotations: Vec<AnnotationRecord>,
    pub stats: DecodeStats,
}

pub struct GenomicCoordinator;

impl GenomicCoordinator {
    /// Decodes payloads for matched entries from a seekable PlasmidReader.
    pub fn decode_slice<R: Read + Seek>(
        reader: &mut PlasmidReader<R>,
        chrom_name: &str,
        start_pos: u64,
        end_pos: u64,
    ) -> Result<UnifiedGenomicSlice> {
        let chrom_id = chrom_to_id(chrom_name)?;
        let entries = reader.query(chrom_id, start_pos, end_pos, None);

        let mut entries_with_payloads = Vec::with_capacity(entries.len());
        for entry in entries {
            let payload = reader.read_entry_payload(&entry)?;
            entries_with_payloads.push((entry, payload));
        }

        Self::decode_entries(&entries_with_payloads, chrom_name, start_pos, end_pos)
    }

    /// Decodes an in-memory batch of index entries and their downloaded byte payloads (e.g. from HTTP Range requests).
    pub fn decode_entries(
        entries_with_payloads: &[(PlasmidIndexEntry, Vec<u8>)],
        chrom_name: &str,
        start_pos: u64,
        end_pos: u64,
    ) -> Result<UnifiedGenomicSlice> {
        let mut variants = Vec::new();
        let mut annotations = Vec::new();
        let mut reference_sequence = None;
        let mut total_bytes = 0;

        for (entry, payload) in entries_with_payloads {
            total_bytes += payload.len();
            match entry.entry_type {
                EntryType::VcfVariant => {
                    let mut records = VcfDecoder::decode_slice(payload)?;
                    variants.append(&mut records);
                }
                EntryType::ClinVarAnnotation | EntryType::WikiMarkdown => {
                    let ann = AnnotationDecoder::decode(payload)?;
                    annotations.push(ann);
                }
                EntryType::ReferenceFasta => {
                    let fastas = FastaDecoder::decode_slice(payload)?;
                    if let Some(first) = fastas.first() {
                        // Extract subsequence matching query range
                        if let Ok(sub) = first.slice_1based(start_pos, end_pos) {
                            reference_sequence = Some(sub.to_string());
                        } else {
                            reference_sequence = Some(first.sequence.clone());
                        }
                    }
                }
                _ => {}
            }
        }

        let stats = DecodeStats {
            variants_count: variants.len(),
            annotations_count: annotations.len(),
            total_bytes_processed: total_bytes,
        };

        Ok(UnifiedGenomicSlice {
            chrom: chrom_name.to_string(),
            start_pos,
            end_pos,
            variants,
            reference_sequence,
            annotations,
            stats,
        })
    }
}
