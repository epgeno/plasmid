pub mod annotation;
pub mod fasta;
pub mod vcf;

pub use annotation::{AnnotationDecoder, AnnotationRecord};
pub use fasta::{FastaDecoder, FastaRecord};
pub use vcf::{VcfDecoder, VcfVariantRecord};

use crate::chrom::chrom_to_id;
use crate::error::{PlasmidCoreError, Result};
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
    /// Decodes payloads for matched entries from a seekable PlasmidReader (flat or hierarchical).
    pub fn decode_slice<R: Read + Seek>(
        reader: &mut PlasmidReader<R>,
        chrom_name: &str,
        start_pos: u64,
        end_pos: u64,
    ) -> Result<UnifiedGenomicSlice> {
        Self::decode_slice_filtered(reader, chrom_name, start_pos, end_pos, None)
    }

    /// Decodes payloads for matched entries with an optional entry-type filter across flat and hierarchical indices.
    pub fn decode_slice_filtered<R: Read + Seek>(
        reader: &mut PlasmidReader<R>,
        chrom_name: &str,
        start_pos: u64,
        end_pos: u64,
        filter_type: Option<EntryType>,
    ) -> Result<UnifiedGenomicSlice> {
        if start_pos > end_pos {
            return Err(PlasmidCoreError::InvalidCoordinateRange {
                start: start_pos,
                end: end_pos,
            });
        }

        let chrom_id = chrom_to_id(chrom_name)?;
        let entries = reader.query_range(chrom_id, start_pos, end_pos, filter_type)?;

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
        let target_chrom_id = chrom_to_id(chrom_name).ok();
        let mut variants = Vec::new();
        let mut annotations = Vec::new();
        let mut reference_buf = String::new();
        let mut total_bytes = 0;

        for (entry, payload) in entries_with_payloads {
            total_bytes += payload.len();
            match entry.entry_type {
                EntryType::VcfVariant => {
                    let records = VcfDecoder::decode_slice(payload)?;
                    for record in records {
                        let var_start = record.pos;
                        let var_end = record
                            .pos
                            .saturating_add((record.reference.len().max(1) as u64) - 1);
                        let chrom_matches = match (chrom_to_id(&record.chrom).ok(), target_chrom_id)
                        {
                            (Some(rc), Some(tc)) => rc == tc,
                            _ => record.chrom == chrom_name,
                        };
                        if chrom_matches && var_start <= end_pos && var_end >= start_pos {
                            variants.push(record);
                        }
                    }
                }
                EntryType::ClinVarAnnotation | EntryType::WikiMarkdown => {
                    let ann = AnnotationDecoder::decode(payload)?;
                    annotations.push(ann);
                }
                EntryType::ReferenceFasta => {
                    let fastas = FastaDecoder::decode_slice(payload)?;
                    if let Some(first) = fastas.first() {
                        let overlap_start = start_pos.max(entry.start_pos);
                        let overlap_end = end_pos.min(entry.end_pos);

                        if overlap_start <= overlap_end && overlap_start >= entry.start_pos {
                            let rel_start = overlap_start - entry.start_pos + 1;
                            let rel_end = overlap_end - entry.start_pos + 1;
                            if let Ok(sub) = first.slice_1based(rel_start, rel_end) {
                                reference_buf.push_str(sub);
                                continue;
                            }
                        }

                        if let Ok(sub) = first.slice_1based(start_pos, end_pos) {
                            reference_buf.push_str(sub);
                        } else if reference_buf.is_empty() {
                            reference_buf.push_str(&first.sequence);
                        }
                    }
                }
                _ => {}
            }
        }

        let reference_sequence = if reference_buf.is_empty() {
            None
        } else {
            Some(reference_buf)
        };

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

#[cfg(test)]
mod tests {
    use super::*;
    use plasmid_format::PlasmidBuilder;
    use std::io::Cursor;

    #[test]
    fn test_decode_slice_hierarchical_and_packed_variants() {
        let mut builder = PlasmidBuilder::new("GRCh38");

        // Pack 3 newline-delimited variants into a single 16KB chunk on chr7
        let packed_chr7_vcf = concat!(
            "chr7\t140453100\trs1000001\tA\tG\t99\tPASS\tGENE=BRAF;CLNSIG=Benign\n",
            "chr7\t140453136\trs113488022\tT\tA\t100\tPASS\tGENE=BRAF;CLNSIG=Pathogenic;AA=p.Val600Glu\n",
            "chr7\t140453900\trs1000002\tC\tT\t95\tPASS\tGENE=BRAF;CLNSIG=Likely_benign\n"
        );
        builder.add_item(
            7,
            EntryType::VcfVariant,
            140453100,
            140453900,
            packed_chr7_vcf.as_bytes().to_vec(),
        );

        // Single variant without trailing newline on chr17
        let single_chr17_vcf =
            b"chr17\t7673770\trs28934578\tC\tT\t100\tPASS\tGENE=TP53;CLNSIG=Pathogenic";
        builder.add_item(
            17,
            EntryType::VcfVariant,
            7673770,
            7673770,
            single_chr17_vcf.to_vec(),
        );

        // Annotation on chr7
        let braf_note = b"## chr7:140453120-140453160 BRAF V600E\nACMG: PS1, PM1. PMID:12068308\n";
        builder.add_item(
            7,
            EntryType::ClinVarAnnotation,
            140453120,
            140453160,
            braf_note.to_vec(),
        );

        // Build both flat and hierarchical archives and verify identical decoding
        let mut flat_bytes = Vec::new();
        builder.build(&mut flat_bytes).unwrap();

        let mut hier_bytes = Vec::new();
        builder.build_hierarchical(&mut hier_bytes, 1).unwrap();

        for container_bytes in [flat_bytes, hier_bytes] {
            let mut reader = PlasmidReader::new(Cursor::new(container_bytes)).unwrap();

            // Narrow sub-window inside packed chunk: must return ONLY the variant at 140453136
            let narrow =
                GenomicCoordinator::decode_slice(&mut reader, "chr7", 140453130, 140453150)
                    .unwrap();
            assert_eq!(narrow.variants.len(), 1);
            assert_eq!(narrow.variants[0].pos, 140453136);
            assert_eq!(narrow.variants[0].id.as_deref(), Some("rs113488022"));
            assert_eq!(narrow.annotations.len(), 1);

            // Full window spanning all 3 packed variants on chr7
            let wide = GenomicCoordinator::decode_slice(&mut reader, "chr7", 140453000, 140454000)
                .unwrap();
            assert_eq!(wide.variants.len(), 3);
            assert_eq!(wide.variants[0].pos, 140453100);
            assert_eq!(wide.variants[1].pos, 140453136);
            assert_eq!(wide.variants[2].pos, 140453900);

            // Single un-terminated item on chr17
            let chr17_slice =
                GenomicCoordinator::decode_slice(&mut reader, "chr17", 7673700, 7673800).unwrap();
            assert_eq!(chr17_slice.variants.len(), 1);
            assert_eq!(chr17_slice.variants[0].gene.as_deref(), Some("TP53"));
        }
    }
}
