pub mod builder;
pub mod error;
pub mod header;
pub mod index;
pub mod merkle;
pub mod reader;

pub use builder::PlasmidBuilder;
pub use error::{PlasmidFormatError, Result};
pub use header::{PlasmidHeader, CURRENT_VERSION, DEFAULT_CHUNK_SIZE, HEADER_SIZE, PLASMID_MAGIC};
pub use index::{EntryType, PlasmidDirectory, PlasmidIndexEntry, INDEX_ENTRY_SIZE};
pub use merkle::{hash_leaf, hash_node, MerkleTree, HASH_SIZE};
pub use reader::PlasmidReader;

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_end_to_end_container_flow() {
        // 1. Build container
        let mut builder = PlasmidBuilder::new("GRCh38");
        builder.set_metadata(r#"{"source":"ClinVar+GRCh38","author":"epgeno"}"#);

        // Add 3 different genomic items:
        // Item A: chr7:140453136-140453137 (BRAF V600E variant)
        let braf_vcf =
            b"chr7\t140453136\trs113488022\tT\tA\t100\tPASS\tGENE=BRAF;CLNSIG=Pathogenic";
        builder.add_item(
            7,
            EntryType::VcfVariant,
            140453136,
            140453137,
            braf_vcf.to_vec(),
        );

        // Item B: chr7:140453100-140453200 (ClinVar knowledge markdown summary)
        let braf_wiki = b"# BRAF V600E\nValine-to-glutamic acid substitution at codon 600.";
        builder.add_item(
            7,
            EntryType::ClinVarAnnotation,
            140453100,
            140453200,
            braf_wiki.to_vec(),
        );

        // Item C: chr17:7673700-7673800 (TP53 variant)
        let tp53_vcf = b"chr17\t7673770\trs28934578\tC\tT\t100\tPASS\tGENE=TP53;CLNSIG=Pathogenic";
        builder.add_item(
            17,
            EntryType::VcfVariant,
            7673700,
            7673800,
            tp53_vcf.to_vec(),
        );

        let mut output_bytes = Vec::new();
        let header = builder.build(&mut output_bytes).expect("Build failed");

        assert_eq!(header.reference_build, "GRCh38");
        assert_eq!(header.total_chunks, 3); // 3 items aligned to 16KB each = 3 chunks

        // 2. Read container back using PlasmidReader
        let cursor = Cursor::new(output_bytes);
        let mut reader = PlasmidReader::new(cursor).expect("Reader init failed");

        assert_eq!(reader.header.reference_build, "GRCh38");
        assert_eq!(
            reader.metadata_json,
            r#"{"source":"ClinVar+GRCh38","author":"epgeno"}"#
        );

        // 3. Verify Merkle Root Integrity
        let valid = reader.verify_integrity().expect("Integrity check failed");
        assert!(valid, "Merkle root integrity check must pass");

        // 4. Query BRAF locus on chr7
        let results = reader.query(7, 140453136, 140453136, None);
        assert_eq!(results.len(), 2, "Expected 2 matching items on chr7");

        // Check VCF payload
        let vcf_entry = results
            .iter()
            .find(|e| e.entry_type == EntryType::VcfVariant)
            .unwrap();
        let payload = reader.read_entry_payload(vcf_entry).unwrap();
        assert_eq!(payload, braf_vcf);

        // Check ClinVar annotation payload
        let wiki_entry = results
            .iter()
            .find(|e| e.entry_type == EntryType::ClinVarAnnotation)
            .unwrap();
        let wiki_payload = reader.read_entry_payload(wiki_entry).unwrap();
        assert_eq!(wiki_payload, braf_wiki);

        // 5. Query non-existent range
        let empty_results = reader.query(7, 100, 200, None);
        assert!(empty_results.is_empty());
    }
}
