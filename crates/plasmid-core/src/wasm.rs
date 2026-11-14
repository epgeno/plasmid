use crate::chrom::{chrom_to_id, id_to_chrom};
use crate::decoder::{GenomicCoordinator, UnifiedGenomicSlice};
use crate::error::{PlasmidCoreError, Result};
use crate::slicing::{ByteRange, RangePlanner, SlicingPlan, coalesce_byte_ranges};
use plasmid_format::{
    FLAG_HIERARCHICAL_INDEX, MerkleTree, PlasmidDirectory, PlasmidHeader, PlasmidIndexEntry,
    PlasmidLeafPointer, PlasmidRootDirectory, hash_leaf,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[cfg(feature = "wasm")]
use crate::decoder::{AnnotationDecoder, FastaDecoder, VcfDecoder};
#[cfg(feature = "wasm")]
use crate::liftover::{CoordinateGuard, GenomeBuild, LiftoverEngine};
#[cfg(feature = "wasm")]
use crate::pyramid::PyramidIndex;
#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WasmHeaderInfo {
    pub version: u16,
    pub flags: u16,
    pub is_hierarchical: bool,
    pub reference_build: String,
    pub root_hash_hex: String,
    pub root_hash_bytes: Vec<u8>,
    pub chunk_size: u32,
    pub total_chunks: u64,
    pub total_payload_bytes: u64,
    pub index_offset: u64,
    pub index_length: u64,
    pub metadata_offset: u64,
    pub metadata_length: u64,
    pub payload_offset: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WasmLeafPointerInfo {
    pub chrom_id: u16,
    pub chrom_name: String,
    pub flags: u16,
    pub min_pos: u64,
    pub max_pos: u64,
    pub leaf_offset: u64,
    pub leaf_length: u32,
    pub entry_count: u32,
}

impl From<PlasmidLeafPointer> for WasmLeafPointerInfo {
    fn from(ptr: PlasmidLeafPointer) -> Self {
        Self {
            chrom_id: ptr.chrom_id,
            chrom_name: id_to_chrom(ptr.chrom_id),
            flags: ptr.flags,
            min_pos: ptr.min_pos,
            max_pos: ptr.max_pos,
            leaf_offset: ptr.leaf_offset,
            leaf_length: ptr.leaf_length,
            entry_count: ptr.entry_count,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WasmLeafQueryPlan {
    pub chrom_id: u16,
    pub leaves: Vec<WasmLeafPointerInfo>,
    pub byte_ranges: Vec<ByteRange>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WasmIndexEntryInfo {
    pub chrom_id: u16,
    pub chrom_name: String,
    pub entry: PlasmidIndexEntry,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WasmChunkHashInfo {
    pub chunk_index: u32,
    pub byte_length: usize,
    pub sha256_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WasmDecodedSlice {
    pub slice: UnifiedGenomicSlice,
    pub chunk_hashes: Vec<WasmChunkHashInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WasmMerkleVerification {
    pub verified: bool,
    pub expected_root_hex: String,
    pub calculated_root_hex: String,
    pub total_chunks: usize,
    pub verified_bytes: usize,
    pub chunk_hashes: Vec<String>,
}

pub fn hex_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        use std::fmt::Write;
        let _ = write!(&mut out, "{b:02x}");
    }
    out
}

pub fn parse_header_dto(header_bytes: &[u8]) -> Result<WasmHeaderInfo> {
    let header = PlasmidHeader::deserialize(header_bytes)?;
    let is_hierarchical = (header.flags & FLAG_HIERARCHICAL_INDEX) != 0;
    let payload_offset = header.metadata_offset + header.metadata_length;

    Ok(WasmHeaderInfo {
        version: header.version,
        flags: header.flags,
        is_hierarchical,
        reference_build: header.reference_build,
        root_hash_hex: hex_encode(&header.root_hash),
        root_hash_bytes: header.root_hash.to_vec(),
        chunk_size: header.chunk_size,
        total_chunks: header.total_chunks,
        total_payload_bytes: header.total_payload_bytes,
        index_offset: header.index_offset,
        index_length: header.index_length,
        metadata_offset: header.metadata_offset,
        metadata_length: header.metadata_length,
        payload_offset,
    })
}

pub fn parse_root_directory_dto(root_dir_bytes: &[u8]) -> Result<Vec<WasmLeafPointerInfo>> {
    let root = PlasmidRootDirectory::deserialize(root_dir_bytes)?;
    Ok(root.leaves.into_iter().map(Into::into).collect())
}

pub fn query_root_leaves_dto(
    root_dir_bytes: &[u8],
    chrom: &str,
    start_pos: u64,
    end_pos: u64,
) -> Result<WasmLeafQueryPlan> {
    if start_pos > end_pos {
        return Err(PlasmidCoreError::InvalidCoordinateRange {
            start: start_pos,
            end: end_pos,
        });
    }

    let root = PlasmidRootDirectory::deserialize(root_dir_bytes)?;
    let chrom_id = if chrom == "*" || chrom.eq_ignore_ascii_case("all") {
        0
    } else {
        chrom_to_id(chrom)?
    };

    let leaves = root.find_overlapping_leaves(chrom_id, start_pos, end_pos);
    let raw_ranges: Vec<ByteRange> = leaves
        .iter()
        .filter(|l| l.leaf_length > 0)
        .map(|l| ByteRange::new(l.leaf_offset, l.leaf_offset + l.leaf_length as u64 - 1))
        .collect();
    let byte_ranges = coalesce_byte_ranges(raw_ranges, 0);

    Ok(WasmLeafQueryPlan {
        chrom_id,
        leaves: leaves.into_iter().map(Into::into).collect(),
        byte_ranges,
    })
}

pub fn parse_directory_entries_dto(directory_bytes: &[u8]) -> Result<Vec<WasmIndexEntryInfo>> {
    let dir = PlasmidDirectory::deserialize(directory_bytes)?;
    Ok(dir
        .entries
        .into_iter()
        .map(|entry| WasmIndexEntryInfo {
            chrom_id: entry.chrom_id,
            chrom_name: id_to_chrom(entry.chrom_id),
            entry,
        })
        .collect())
}

pub fn plan_range_slice_dto(
    directory_bytes: &[u8],
    chrom: &str,
    start_pos: u64,
    end_pos: u64,
    payload_offset: u64,
    chunk_size: u32,
) -> Result<SlicingPlan> {
    let directory = PlasmidDirectory::deserialize(directory_bytes)?;
    RangePlanner::plan_slice(
        &directory,
        chrom,
        start_pos,
        end_pos,
        None,
        payload_offset,
        chunk_size,
    )
}

pub fn decode_planned_slice_dto(
    entries: &[PlasmidIndexEntry],
    chunks_concat: &[u8],
    chunk_indices: &[u32],
    chunk_size: u32,
    chrom: &str,
    start_pos: u64,
    end_pos: u64,
) -> Result<WasmDecodedSlice> {
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

    let mut entries_with_payloads = Vec::with_capacity(entries.len());
    for entry in entries {
        let mut combined = Vec::with_capacity((entry.chunk_count as usize) * csize);
        for c in 0..entry.chunk_count {
            let target_idx = entry.chunk_start + c;
            let chunk_bytes = chunk_map.get(&target_idx).ok_or_else(|| {
                PlasmidCoreError::Serialization(format!(
                    "Missing required chunk #{target_idx} for entry at {}:{}",
                    id_to_chrom(entry.chrom_id),
                    entry.start_pos
                ))
            })?;
            combined.extend_from_slice(chunk_bytes);
        }
        combined.truncate(entry.payload_bytes as usize);
        entries_with_payloads.push((*entry, combined));
    }

    let slice =
        GenomicCoordinator::decode_entries(&entries_with_payloads, chrom, start_pos, end_pos)?;

    Ok(WasmDecodedSlice {
        slice,
        chunk_hashes,
    })
}

pub fn verify_merkle_tree_dto(
    payload_bytes: &[u8],
    chunk_size: u32,
    expected_root_hex: &str,
) -> Result<WasmMerkleVerification> {
    if chunk_size == 0 {
        return Err(PlasmidCoreError::Serialization(
            "chunk_size must be greater than zero".to_string(),
        ));
    }
    let csize = chunk_size as usize;
    if !payload_bytes.len().is_multiple_of(csize) {
        return Err(PlasmidCoreError::Serialization(format!(
            "Payload byte length ({}) is not a multiple of chunk_size ({})",
            payload_bytes.len(),
            csize
        )));
    }

    let total_chunks = payload_bytes.len() / csize;
    let mut leaves = Vec::with_capacity(total_chunks);
    let mut chunk_hashes = Vec::with_capacity(total_chunks);

    for i in 0..total_chunks {
        let chunk = &payload_bytes[i * csize..(i + 1) * csize];
        let digest = hash_leaf(chunk);
        chunk_hashes.push(hex_encode(&digest));
        leaves.push(digest);
    }

    let tree = MerkleTree::from_leaves(leaves);
    let calculated_root_hex = hex_encode(&tree.root());
    let clean_expected = expected_root_hex.trim().trim_start_matches("0x");
    let verified = calculated_root_hex.eq_ignore_ascii_case(clean_expected);

    Ok(WasmMerkleVerification {
        verified,
        expected_root_hex: clean_expected.to_lowercase(),
        calculated_root_hex,
        total_chunks,
        verified_bytes: payload_bytes.len(),
        chunk_hashes,
    })
}

#[cfg(feature = "wasm")]
fn to_js_json<T: Serialize>(value: &T) -> std::result::Result<JsValue, JsValue> {
    value
        .serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {e}")))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub struct PlasmidWasmEngine;

#[cfg(feature = "wasm")]
#[wasm_bindgen]
impl PlasmidWasmEngine {
    /// Parses the 128-byte .plasmid binary header into structured metadata and byte offsets.
    #[wasm_bindgen]
    pub fn parse_header(header_bytes: &[u8]) -> std::result::Result<JsValue, JsValue> {
        let info = parse_header_dto(header_bytes)
            .map_err(|e| JsValue::from_str(&format!("Header parse error: {e}")))?;
        to_js_json(&info)
    }

    /// Parses all leaf directory pointers from a hierarchical Root Directory buffer.
    #[wasm_bindgen]
    pub fn parse_root_directory(root_dir_bytes: &[u8]) -> std::result::Result<JsValue, JsValue> {
        let leaves = parse_root_directory_dto(root_dir_bytes)
            .map_err(|e| JsValue::from_str(&format!("Root directory parse error: {e}")))?;
        to_js_json(&leaves)
    }

    /// Finds overlapping leaf directory pointers and coalesced HTTP Range headers for a coordinate window.
    #[wasm_bindgen]
    pub fn query_root_leaves(
        root_dir_bytes: &[u8],
        chrom: &str,
        start_pos: f64,
        end_pos: f64,
    ) -> std::result::Result<JsValue, JsValue> {
        let plan = query_root_leaves_dto(root_dir_bytes, chrom, start_pos as u64, end_pos as u64)
            .map_err(|e| JsValue::from_str(&format!("Leaf query error: {e}")))?;
        to_js_json(&plan)
    }

    /// Parses 32-byte PlasmidIndexEntry records from a flat directory or concatenated leaf directories.
    #[wasm_bindgen]
    pub fn parse_directory_entries(
        directory_bytes: &[u8],
    ) -> std::result::Result<JsValue, JsValue> {
        let entries = parse_directory_entries_dto(directory_bytes)
            .map_err(|e| JsValue::from_str(&format!("Directory entries parse error: {e}")))?;
        to_js_json(&entries)
    }

    /// Plans minimal HTTP Range Requests from a downloaded .plasmid flat or leaf directory index.
    #[wasm_bindgen]
    pub fn plan_range_slice(
        directory_bytes: &[u8],
        chrom: &str,
        start_pos: f64,
        end_pos: f64,
        payload_offset: f64,
        chunk_size: u32,
    ) -> std::result::Result<JsValue, JsValue> {
        let plan = plan_range_slice_dto(
            directory_bytes,
            chrom,
            start_pos as u64,
            end_pos as u64,
            payload_offset as u64,
            chunk_size,
        )
        .map_err(|e| JsValue::from_str(&format!("Planning error: {e}")))?;

        to_js_json(&plan)
    }

    /// Decodes downloaded 16KB Merkle leaf chunks against planned index entries and computes SHA-256 digests.
    #[wasm_bindgen]
    pub fn decode_planned_slice(
        entries_json: &str,
        chunks_concat: &[u8],
        chunk_indices: &[u32],
        chunk_size: u32,
        chrom: &str,
        start_pos: f64,
        end_pos: f64,
    ) -> std::result::Result<JsValue, JsValue> {
        let entries: Vec<PlasmidIndexEntry> = serde_json::from_str(entries_json)
            .map_err(|e| JsValue::from_str(&format!("Entries JSON error: {e}")))?;

        let decoded = decode_planned_slice_dto(
            &entries,
            chunks_concat,
            chunk_indices,
            chunk_size,
            chrom,
            start_pos as u64,
            end_pos as u64,
        )
        .map_err(|e| JsValue::from_str(&format!("Slice decode error: {e}")))?;

        to_js_json(&decoded)
    }

    /// Zero-copy decode of a VCF variant chunk downloaded via HTTP Range or P2P WebRTC.
    #[wasm_bindgen]
    pub fn decode_vcf_chunk(chunk_bytes: &[u8]) -> std::result::Result<JsValue, JsValue> {
        let variants = VcfDecoder::decode_slice(chunk_bytes)
            .map_err(|e| JsValue::from_str(&format!("VCF decode error: {e}")))?;

        to_js_json(&variants)
    }

    /// Decodes ClinVar/Wiki markdown annotations and ACMG rules from an annotation chunk.
    #[wasm_bindgen]
    pub fn decode_annotation_chunk(chunk_bytes: &[u8]) -> std::result::Result<JsValue, JsValue> {
        let annotation = AnnotationDecoder::decode(chunk_bytes)
            .map_err(|e| JsValue::from_str(&format!("Annotation decode error: {e}")))?;

        to_js_json(&annotation)
    }

    /// Decodes FASTA reference sequence for a specific range window.
    #[wasm_bindgen]
    pub fn decode_fasta_chunk(
        chunk_bytes: &[u8],
        start_pos: f64,
        end_pos: f64,
    ) -> std::result::Result<String, JsValue> {
        let records = FastaDecoder::decode_slice(chunk_bytes)
            .map_err(|e| JsValue::from_str(&format!("FASTA decode error: {e}")))?;

        if let Some(first) = records.first() {
            let slice = first
                .slice_1based(start_pos as u64, end_pos as u64)
                .map_err(|e| JsValue::from_str(&format!("FASTA slice error: {e}")))?;
            Ok(slice.to_string())
        } else {
            Err(JsValue::from_str("No FASTA records found in chunk"))
        }
    }

    /// Computes hex-encoded SHA-256 leaf digest of a chunk.
    #[wasm_bindgen]
    pub fn hash_chunk_hex(chunk_bytes: &[u8]) -> String {
        hex_encode(&hash_leaf(chunk_bytes))
    }

    /// Verifies SHA-256 integrity of a downloaded chunk against an expected 32-byte hash.
    #[wasm_bindgen]
    pub fn verify_chunk_hash(chunk_bytes: &[u8], expected_hash: &[u8]) -> bool {
        if expected_hash.len() != 32 {
            return false;
        }
        let computed = hash_leaf(chunk_bytes);
        computed.as_slice() == expected_hash
    }

    /// Recomputes full BEP 52 SHA-256 Merkle Tree over container payload chunks and verifies root hash.
    #[wasm_bindgen]
    pub fn verify_merkle_tree(
        payload_bytes: &[u8],
        chunk_size: u32,
        expected_root_hex: &str,
    ) -> std::result::Result<JsValue, JsValue> {
        let res = verify_merkle_tree_dto(payload_bytes, chunk_size, expected_root_hex)
            .map_err(|e| JsValue::from_str(&format!("Merkle verification error: {e}")))?;
        to_js_json(&res)
    }

    /// Returns authoritative contig lengths and centromere coordinates for GRCh38 or GRCh37.
    #[wasm_bindgen]
    pub fn get_assembly_overview(assembly: &str) -> std::result::Result<JsValue, JsValue> {
        let pyramid = PyramidIndex::new(assembly);
        to_js_json(&pyramid)
    }

    /// Realtime Liftover of GRCh37 (hg19) coordinate to GRCh38 (hg38) in WebAssembly.
    #[wasm_bindgen]
    pub fn liftover_hg19_to_hg38(
        chrom: &str,
        pos: f64,
        ref_allele: &str,
    ) -> std::result::Result<JsValue, JsValue> {
        let engine = LiftoverEngine::new_with_curated_regions();
        let result = engine
            .lift_hg19_to_hg38(chrom, pos as u64, ref_allele)
            .map_err(|e| JsValue::from_str(&format!("Liftover error: {e}")))?;

        to_js_json(&result)
    }

    /// Realtime reverse Liftover of GRCh38 (hg38) coordinate to GRCh37 (hg19) in WebAssembly.
    #[wasm_bindgen]
    pub fn liftover_hg38_to_hg19(
        chrom: &str,
        pos: f64,
        ref_allele: &str,
    ) -> std::result::Result<JsValue, JsValue> {
        let engine = LiftoverEngine::new_with_curated_regions();
        let result = engine
            .lift_hg38_to_hg19(chrom, pos as u64, ref_allele)
            .map_err(|e| JsValue::from_str(&format!("Liftover error: {e}")))?;

        to_js_json(&result)
    }

    /// Verifies single-nucleotide reference sequence fingerprint to block coordinate drift.
    #[wasm_bindgen]
    pub fn verify_ref_fingerprint(
        rsid: &str,
        chrom: &str,
        pos: f64,
        ref_allele: &str,
        reference_slice: &str,
        slice_start_pos: f64,
        target_build: &str,
    ) -> std::result::Result<bool, JsValue> {
        let build = if target_build.contains("37") || target_build.contains("19") {
            GenomeBuild::GRCh37
        } else {
            GenomeBuild::GRCh38
        };
        CoordinateGuard::verify_ref_fingerprint(
            rsid,
            chrom,
            pos as u64,
            ref_allele,
            reference_slice,
            slice_start_pos as u64,
            build,
        )
        .map(|_| true)
        .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Automatically detects genome build (GRCh37 vs GRCh38) from input variant coordinates.
    #[wasm_bindgen]
    pub fn detect_build(variants_json: &str) -> std::result::Result<String, JsValue> {
        let variants: Vec<(String, u64)> = serde_json::from_str(variants_json)
            .map_err(|e| JsValue::from_str(&format!("JSON parse error: {e}")))?;

        match CoordinateGuard::detect_build(&variants) {
            Some(GenomeBuild::GRCh37) => Ok("GRCh37".to_string()),
            Some(GenomeBuild::GRCh38) => Ok("GRCh38".to_string()),
            None => Ok("Unknown".to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use plasmid_format::{EntryType, PlasmidBuilder};

    #[test]
    fn test_wasm_dto_hierarchical_header_index_slice_and_merkle() {
        let mut builder = PlasmidBuilder::new("GRCh38");
        builder.set_metadata(r#"{"license":"Public Domain / CC0"}"#);
        builder.add_item(
            7,
            EntryType::VcfVariant,
            140753336,
            140753336,
            b"chr7\t140753336\trs113488022\tA\tT\t100\tPASS\tGENE=BRAF;CLNSIG=Pathogenic\n"
                .to_vec(),
        );
        builder.add_item(
            17,
            EntryType::VcfVariant,
            7673803,
            7673803,
            b"chr17\t7673803\trs28934578\tG\tA\t95\tPASS\tGENE=TP53;CLNSIG=Pathogenic\n".to_vec(),
        );

        let mut container = Vec::new();
        builder.build_hierarchical(&mut container, 1).unwrap();

        // 1. Parse 128B header
        let header = parse_header_dto(&container[0..128]).unwrap();
        assert!(header.is_hierarchical);
        assert_eq!(header.reference_build, "GRCh38");
        assert_eq!(header.total_chunks, 2);

        // 2. Query root leaves for chr17
        let root_start = header.index_offset as usize;
        let root_end = root_start + header.index_length as usize;
        let leaf_plan =
            query_root_leaves_dto(&container[root_start..root_end], "chr17", 7671000, 7677000)
                .unwrap();
        assert_eq!(leaf_plan.leaves.len(), 1);
        assert_eq!(leaf_plan.byte_ranges.len(), 1);

        // 3. Slice leaf bytes and plan payload range
        let leaf_range = leaf_plan.byte_ranges[0];
        let leaf_bytes = &container[leaf_range.start as usize..=leaf_range.end as usize];
        let slice_plan = plan_range_slice_dto(
            leaf_bytes,
            "chr17",
            7671000,
            7677000,
            header.payload_offset,
            header.chunk_size,
        )
        .unwrap();
        assert_eq!(slice_plan.chunk_indices, vec![1]);
        assert_eq!(slice_plan.byte_ranges.len(), 1);

        // 4. Decode planned slice and verify chunk hash
        let chunk_range = slice_plan.byte_ranges[0];
        let chunk_bytes = &container[chunk_range.start as usize..=chunk_range.end as usize];
        let decoded = decode_planned_slice_dto(
            &slice_plan.entries,
            chunk_bytes,
            &slice_plan.chunk_indices,
            header.chunk_size,
            "chr17",
            7671000,
            7677000,
        )
        .unwrap();
        assert_eq!(decoded.slice.variants.len(), 1);
        assert_eq!(decoded.slice.variants[0].gene.as_deref(), Some("TP53"));
        assert_eq!(decoded.chunk_hashes.len(), 1);
        assert_eq!(decoded.chunk_hashes[0].sha256_hex.len(), 64);

        // 5. Verify full Merkle root over payload
        let payload_bytes = &container[header.payload_offset as usize..];
        let merkle =
            verify_merkle_tree_dto(payload_bytes, header.chunk_size, &header.root_hash_hex)
                .unwrap();
        assert!(merkle.verified);
        assert_eq!(merkle.total_chunks, 2);

        // Tampered root hash must fail verification
        let bad_merkle = verify_merkle_tree_dto(
            payload_bytes,
            header.chunk_size,
            "0000000000000000000000000000000000000000000000000000000000000000",
        )
        .unwrap();
        assert!(!bad_merkle.verified);
    }
}
