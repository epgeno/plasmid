pub mod chrom;
pub mod decoder;
pub mod error;
pub mod liftover;
pub mod slicing;
pub mod wasm;
pub mod zero_copy;

pub use chrom::{chrom_to_id, grch38_contig_length, id_to_chrom};
pub use decoder::{
    AnnotationDecoder, AnnotationRecord, DecodeStats, FastaDecoder, FastaRecord,
    GenomicCoordinator, UnifiedGenomicSlice, VcfDecoder, VcfVariantRecord,
};
pub use error::{PlasmidCoreError, Result};
pub use liftover::{
    AnchorSnp, CoordinateGuard, GenomeBuild, LiftoverEngine, LiftoverInterval, LiftoverResult,
    CURATED_ANCHOR_SNPS,
};
pub use slicing::{ByteRange, RangePlanner, SlicingPlan, coalesce_byte_ranges};
#[cfg(feature = "wasm")]
pub use wasm::PlasmidWasmEngine;
pub use zero_copy::SliceBuffer;

#[cfg(test)]
mod tests {
    use super::*;
    use plasmid_format::{EntryType, PlasmidBuilder, PlasmidReader};
    use std::io::Cursor;

    #[test]
    fn test_end_to_end_slicing_and_decoding() {
        let mut builder = PlasmidBuilder::new("GRCh38");

        // BRAF V600E variant
        let braf_vcf = b"chr7\t140453136\trs113488022\tT\tA\t100\tPASS\tGENE=BRAF;CLNSIG=Pathogenic;AA=p.Val600Glu";
        builder.add_item(
            7,
            EntryType::VcfVariant,
            140453136,
            140453137,
            braf_vcf.to_vec(),
        );

        // BRAF ClinVar note
        let braf_note = b"### BRAF V600E Mutation\nClinVar Pathogenic variant. [PS1, PS3, PM1, PM2, PP3]. PMID:12068308";
        builder.add_item(
            7,
            EntryType::ClinVarAnnotation,
            140453100,
            140453200,
            braf_note.to_vec(),
        );

        // Reference FASTA chunk
        let ref_fasta = b">chr7\nGTGATTTTGGTCTAGCTACAGTGAAATCTCGATGGAGTGGGTCCCATCAGTTTGAACAGTTGTCTGGATCCATTTTG\n";
        builder.add_item(
            7,
            EntryType::ReferenceFasta,
            140453100,
            140453178,
            ref_fasta.to_vec(),
        );

        let mut out = Vec::new();
        let _header = builder.build(&mut out).unwrap();

        let cursor = Cursor::new(out);
        let mut reader = PlasmidReader::new(cursor).unwrap();

        // 1. Planning test
        let plan = RangePlanner::plan_reader(
            &mut reader,
            "chr7",
            140453136,
            140453136,
            None,
        )
        .unwrap();

        assert_eq!(plan.chrom_id, 7);
        assert!(!plan.chunk_indices.is_empty());
        assert!(!plan.byte_ranges.is_empty());
        assert!(plan.byte_ranges[0].to_http_header().starts_with("bytes="));

        // 2. Decode test
        let decoded =
            GenomicCoordinator::decode_slice(&mut reader, "chr7", 140453136, 140453136).unwrap();

        assert_eq!(decoded.variants.len(), 1);
        let v = &decoded.variants[0];
        assert_eq!(v.pos, 140453136);
        assert_eq!(v.id.as_deref(), Some("rs113488022"));
        assert_eq!(v.gene.as_deref(), Some("BRAF"));
        assert_eq!(v.clinvar_significance.as_deref(), Some("Pathogenic"));
        assert!(v.is_pathogenic());

        assert_eq!(decoded.annotations.len(), 1);
        let ann = &decoded.annotations[0];
        assert_eq!(ann.title, "BRAF V600E Mutation");
        assert!(ann.acmg_criteria.contains(&"PS1".to_string()));
        assert!(ann.pubmed_ids.contains(&"12068308".to_string()));

        assert!(decoded.reference_sequence.is_some());
    }

    #[test]
    fn test_zero_copy_slice_validation() {
        let chunk_data = vec![0x42u8; 16384];
        let slice_buf = SliceBuffer::new(&chunk_data);
        assert_eq!(slice_buf.len(), 16384);

        let sub = slice_buf.subslice(100, 200).unwrap();
        assert_eq!(sub.len(), 100);
        assert_eq!(sub[0], 0x42);
    }
}
