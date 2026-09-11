pub mod builder;
pub mod error;
pub mod header;
pub mod index;
pub mod merkle;
pub mod reader;

pub use builder::PlasmidBuilder;
pub use error::{PlasmidFormatError, Result};
pub use header::{
    CURRENT_VERSION, DEFAULT_CHUNK_SIZE, FLAG_HIERARCHICAL_INDEX, HEADER_SIZE, PLASMID_MAGIC,
    PlasmidHeader,
};
pub use index::{
    EntryType, INDEX_ENTRY_SIZE, INDEX_LEAF_POINTER_SIZE, PlasmidDirectory, PlasmidIndexEntry,
    PlasmidLeafPointer, PlasmidRootDirectory,
};
pub use merkle::{HASH_SIZE, MerkleTree, hash_leaf, hash_node};
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

    #[test]
    fn test_hierarchical_leaf_directory_end_to_end() {
        let mut builder = PlasmidBuilder::new("GRCh38");
        builder.set_metadata(r#"{"mode":"hierarchical_test"}"#);

        // Add variants across chr1, chr7, chr17, chr22
        for pos in [1000, 2000, 3000] {
            builder.add_item(
                1,
                EntryType::VcfVariant,
                pos,
                pos + 1,
                format!("chr1 variant at {pos}").into_bytes(),
            );
        }
        for pos in [4000, 5000] {
            builder.add_item(
                7,
                EntryType::ClinVarAnnotation,
                pos,
                pos + 10,
                format!("chr7 annotation at {pos}").into_bytes(),
            );
        }
        for pos in [7000, 8000, 9000] {
            builder.add_item(
                17,
                EntryType::VcfVariant,
                pos,
                pos + 1,
                format!("chr17 variant at {pos}").into_bytes(),
            );
        }

        let mut output_bytes = Vec::new();
        // Build with max 2 entries per leaf directory to force hierarchical multi-leaf split
        let header = builder
            .build_hierarchical(&mut output_bytes, 2)
            .expect("Hierarchical build failed");

        assert_eq!(header.flags, FLAG_HIERARCHICAL_INDEX);

        let cursor = Cursor::new(output_bytes);
        let mut reader = PlasmidReader::new(cursor).expect("Hierarchical reader failed");
        assert!(reader.is_hierarchical());
        assert!(reader.root_directory.is_some());

        // Verify leaf pointers exist
        let leaves = reader.query_leaf_pointers(17, 7000, 8500);
        assert!(!leaves.is_empty(), "Must find overlapping leaves on chr17");

        // Query ranges dynamically through leaf indirection
        let chr17_results = reader
            .query_range(17, 7000, 8500, None)
            .expect("Query failed");
        assert_eq!(chr17_results.len(), 2); // 7000 and 8000
        assert_eq!(chr17_results[0].start_pos, 7000);
        assert_eq!(chr17_results[1].start_pos, 8000);

        // Read payload from queried entry
        let payload = reader.read_entry_payload(&chr17_results[0]).unwrap();
        assert_eq!(payload, b"chr17 variant at 7000");

        // Verify Merkle integrity remains sound with hierarchical index
        assert!(reader.verify_integrity().unwrap());
    }

    #[test]
    fn test_adversarial_hierarchical_index_reduction() {
        let mut builder = PlasmidBuilder::new("GRCh38");

        // Create 200 variants spread across 20 chromosomes (10 per chr)
        for chrom in 1..=20 {
            for i in 0..10 {
                let pos = (i + 1) * 10_000;
                builder.add_item(
                    chrom,
                    EntryType::VcfVariant,
                    pos,
                    pos + 1,
                    format!("chrom{chrom} item {i}").into_bytes(),
                );
            }
        }

        let mut output_bytes = Vec::new();
        // 10 entries per leaf directory -> exactly 20 leaf directories
        let _header = builder
            .build_hierarchical(&mut output_bytes, 10)
            .expect("Hierarchical build failed");

        let cursor = Cursor::new(output_bytes);
        let reader = PlasmidReader::new(cursor).expect("Reader init failed");

        // Adversarial check:
        // A client targeting ONLY chr14:50000-60000 must query root directory and inspect leaf pointers
        let pointers = reader.query_leaf_pointers(14, 50000, 60000);
        assert_eq!(
            pointers.len(),
            1,
            "Must hit exactly 1 target leaf directory"
        );

        let target_leaf = pointers[0];
        // Leaf size for 10 entries is 10 * 32 bytes = 320 bytes
        assert_eq!(target_leaf.entry_count, 10);
        assert_eq!(target_leaf.leaf_length, 320);

        // Total index across all 20 chromosomes would be 20 * 320 = 6,400 bytes.
        // The client only needs to download the 320-byte slice!
        let total_leaves_bytes = reader
            .root_directory
            .as_ref()
            .unwrap()
            .leaves
            .iter()
            .map(|l| l.leaf_length)
            .sum::<u32>();
        assert_eq!(total_leaves_bytes, 6400);

        let egress_ratio = target_leaf.leaf_length as f64 / total_leaves_bytes as f64;
        assert!(
            egress_ratio <= 0.05,
            "Target leaf must be <= 5% of total index size (measured: {:.2}%)",
            egress_ratio * 100.0
        );
        println!(
            "[Adversarial Reduction] Total Index: {total_leaves_bytes}B, Sliced Leaf: {}B (Reduced by {:.2}%)",
            target_leaf.leaf_length,
            (1.0 - egress_ratio) * 100.0
        );
    }
}
