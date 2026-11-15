use crate::chrom::{chrom_to_id, id_to_chrom};
use crate::decoder::vcf::MAX_VCF_DECOMPRESSED_BYTES;
use crate::decoder::{GenomicCoordinator, UnifiedGenomicSlice, VcfDecoder, VcfVariantRecord};
use crate::error::{PlasmidCoreError, Result};
use crate::liftover::{CoordinateGuard, GenomeBuild};
use crate::pyramid::PyramidIndex;
use crate::slicing::{ByteRange, RangePlanner, SlicingPlan, coalesce_byte_ranges};
use plasmid_format::{
    EntryType, FLAG_HIERARCHICAL_INDEX, HASH_SIZE, HEADER_SIZE, MerkleTree, PlasmidDirectory,
    PlasmidHeader, PlasmidIndexEntry, PlasmidLeafPointer, PlasmidReader, PlasmidRootDirectory,
    decompress_gzip_bounded, decompress_payload, hash_leaf, hash_node, is_gzip_magic,
};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::collections::HashMap;
use std::io::Cursor;

#[cfg(feature = "wasm")]
use crate::decoder::{AnnotationDecoder, FastaDecoder};
#[cfg(feature = "wasm")]
use crate::intersection::{
    intersect_personal_with_clinvar_dto, plan_intersection_chunks_dto, plan_intersection_leaves_dto,
};
#[cfg(feature = "wasm")]
use crate::liftover::LiftoverEngine;
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WasmMerkleProofStep {
    pub sibling_hex: String,
    pub is_right: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WasmChunkMerkleBundle {
    pub chunk_index: u32,
    pub total_chunks: u64,
    pub leaf_sha256_hex: String,
    pub root_hash_hex: String,
    pub proof: Vec<WasmMerkleProofStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WasmChunkProofVerification {
    pub verified: bool,
    pub chunk_index: u32,
    pub total_chunks: u64,
    pub leaf_sha256_hex: String,
    pub calculated_root_hex: String,
    pub expected_root_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WasmChromCoordinateIndex {
    pub chrom_id: u16,
    pub chrom_name: String,
    pub min_pos: u64,
    pub max_pos: u64,
    pub variant_count: u32,
    pub pathogenic_count: u32,
    pub start_index: usize,
    pub end_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WasmVcfDataset {
    pub reference_build: String,
    pub byte_length: usize,
    pub sha256_hex: String,
    pub pyramid: PyramidIndex,
    pub chrom_index: Vec<WasmChromCoordinateIndex>,
    pub variants: Vec<VcfVariantRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WasmLocalPlasmidDataset {
    pub header: WasmHeaderInfo,
    pub metadata_json: String,
    pub merkle: WasmMerkleVerification,
    pub pyramid: PyramidIndex,
    pub chrom_index: Vec<WasmChromCoordinateIndex>,
    pub leaves: Vec<WasmLeafPointerInfo>,
    pub entries: Vec<WasmIndexEntryInfo>,
    pub variants: Vec<VcfVariantRecord>,
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
        let decompressed = decompress_payload(entry.codec()?, &combined)?;
        entries_with_payloads.push((*entry, decompressed));
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

fn hex_decode_32(hex: &str) -> Option<[u8; HASH_SIZE]> {
    let clean = hex.trim().trim_start_matches("0x");
    if clean.len() != HASH_SIZE * 2 {
        return None;
    }
    let mut out = [0u8; HASH_SIZE];
    for (i, slot) in out.iter_mut().enumerate() {
        *slot = u8::from_str_radix(&clean[i * 2..i * 2 + 2], 16).ok()?;
    }
    Some(out)
}

pub fn generate_chunk_proofs_dto(
    payload_bytes: &[u8],
    chunk_size: u32,
    chunk_indices: &[u32],
) -> Result<Vec<WasmChunkMerkleBundle>> {
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
    for i in 0..total_chunks {
        let chunk = &payload_bytes[i * csize..(i + 1) * csize];
        leaves.push(hash_leaf(chunk));
    }

    let tree = MerkleTree::from_leaves(leaves);
    let root_hash_hex = hex_encode(&tree.root());
    let mut bundles = Vec::with_capacity(chunk_indices.len());

    for &chunk_idx in chunk_indices {
        let idx = chunk_idx as usize;
        if idx >= total_chunks {
            return Err(PlasmidCoreError::Serialization(format!(
                "Chunk index {chunk_idx} out of bounds for container with {total_chunks} chunks"
            )));
        }
        let raw_proof = tree.proof(idx).ok_or_else(|| {
            PlasmidCoreError::Serialization(format!(
                "Merkle proof unavailable for chunk #{chunk_idx}"
            ))
        })?;
        let leaf_sha256_hex = hex_encode(&tree.leaves[idx]);
        let proof = raw_proof
            .into_iter()
            .map(|(sib, is_right)| WasmMerkleProofStep {
                sibling_hex: hex_encode(&sib),
                is_right,
            })
            .collect();

        bundles.push(WasmChunkMerkleBundle {
            chunk_index: chunk_idx,
            total_chunks: total_chunks as u64,
            leaf_sha256_hex,
            root_hash_hex: root_hash_hex.clone(),
            proof,
        });
    }

    Ok(bundles)
}

pub fn verify_merkle_chunk_proof_dto(
    chunk_bytes: &[u8],
    chunk_index: u32,
    total_chunks: u64,
    chunk_size: u32,
    expected_root_hex: &str,
    proof: &[WasmMerkleProofStep],
) -> Result<WasmChunkProofVerification> {
    if chunk_size == 0 {
        return Err(PlasmidCoreError::Serialization(
            "chunk_size must be greater than zero".to_string(),
        ));
    }
    let clean_expected = expected_root_hex
        .trim()
        .trim_start_matches("0x")
        .to_lowercase();
    let leaf_digest = hash_leaf(chunk_bytes);
    let leaf_sha256_hex = hex_encode(&leaf_digest);

    if chunk_bytes.len() != chunk_size as usize
        || total_chunks == 0
        || (chunk_index as u64) >= total_chunks
        || hex_decode_32(&clean_expected).is_none()
    {
        return Ok(WasmChunkProofVerification {
            verified: false,
            chunk_index,
            total_chunks,
            leaf_sha256_hex,
            calculated_root_hex: String::new(),
            expected_root_hex: clean_expected,
        });
    }

    let mut current = leaf_digest;
    let mut idx = chunk_index as usize;
    let mut layer_len = total_chunks as usize;
    let mut topology_valid = true;

    for step in proof {
        if layer_len <= 1 {
            topology_valid = false;
            break;
        }
        let expected_is_right = idx % 2 == 1;
        if step.is_right != expected_is_right {
            topology_valid = false;
            break;
        }
        let Some(sibling) = hex_decode_32(&step.sibling_hex) else {
            topology_valid = false;
            break;
        };
        if !expected_is_right && idx + 1 == layer_len && sibling != current {
            topology_valid = false;
            break;
        }

        current = if expected_is_right {
            hash_node(&sibling, &current)
        } else {
            hash_node(&current, &sibling)
        };
        idx /= 2;
        layer_len = layer_len.div_ceil(2);
    }

    if layer_len != 1 {
        topology_valid = false;
    }

    let calculated_root_hex = hex_encode(&current);
    let verified = topology_valid && calculated_root_hex.eq_ignore_ascii_case(&clean_expected);

    Ok(WasmChunkProofVerification {
        verified,
        chunk_index,
        total_chunks,
        leaf_sha256_hex,
        calculated_root_hex,
        expected_root_hex: clean_expected,
    })
}

fn infer_vcf_reference_build(
    vcf_text: &str,
    variants: &[VcfVariantRecord],
    assembly_hint: &str,
) -> String {
    for raw_line in vcf_text.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }
        if !line.starts_with('#') {
            break;
        }
        let lower = line.to_ascii_lowercase();
        if lower.starts_with("##reference=") || lower.starts_with("##assembly=") {
            if lower.contains("grch37") || lower.contains("hg19") || lower.contains("b37") {
                return "GRCh37".to_string();
            }
            if lower.contains("grch38") || lower.contains("hg38") {
                return "GRCh38".to_string();
            }
        } else if lower.starts_with("##contig=") {
            if lower.contains("length=249250621") {
                return "GRCh37".to_string();
            }
            if lower.contains("length=248956422") {
                return "GRCh38".to_string();
            }
        } else if lower.contains("grch37")
            || lower.contains("hg19")
            || lower.contains("build 37")
            || lower.contains("build37")
        {
            return "GRCh37".to_string();
        } else if lower.contains("grch38")
            || lower.contains("hg38")
            || lower.contains("build 38")
            || lower.contains("build38")
        {
            return "GRCh38".to_string();
        }
    }

    let coord_pairs: Vec<(String, u64)> = variants
        .iter()
        .take(512)
        .map(|v| (v.chrom.clone(), v.pos))
        .collect();
    if let Some(detected) = CoordinateGuard::detect_build(&coord_pairs) {
        return match detected {
            GenomeBuild::GRCh37 => "GRCh37".to_string(),
            GenomeBuild::GRCh38 => "GRCh38".to_string(),
        };
    }

    let hint_upper = assembly_hint.to_ascii_uppercase();
    if hint_upper.contains("37") || hint_upper.contains("19") {
        "GRCh37".to_string()
    } else {
        "GRCh38".to_string()
    }
}

fn build_chrom_coordinate_index(
    variants: &mut [VcfVariantRecord],
) -> Vec<WasmChromCoordinateIndex> {
    variants.sort_by(|a, b| {
        let cid_a = chrom_to_id(&a.chrom).unwrap_or(u16::MAX);
        let cid_b = chrom_to_id(&b.chrom).unwrap_or(u16::MAX);
        cid_a
            .cmp(&cid_b)
            .then_with(|| a.chrom.cmp(&b.chrom))
            .then_with(|| a.pos.cmp(&b.pos))
    });

    let mut index: Vec<WasmChromCoordinateIndex> = Vec::new();
    for (idx, v) in variants.iter().enumerate() {
        let cid = chrom_to_id(&v.chrom).unwrap_or(0);
        let var_end = v.pos + (v.reference.len().max(1) as u64) - 1;
        let is_path = u32::from(v.is_pathogenic());

        if let Some(last) = index.last_mut()
            && last.chrom_name == v.chrom
        {
            last.min_pos = last.min_pos.min(v.pos);
            last.max_pos = last.max_pos.max(var_end);
            last.variant_count += 1;
            last.pathogenic_count += is_path;
            last.end_index = idx;
            continue;
        }

        index.push(WasmChromCoordinateIndex {
            chrom_id: cid,
            chrom_name: v.chrom.clone(),
            min_pos: v.pos,
            max_pos: var_end,
            variant_count: 1,
            pathogenic_count: is_path,
            start_index: idx,
            end_index: idx,
        });
    }

    index
}

pub fn parse_vcf_dataset_dto(vcf_bytes: &[u8], assembly_hint: &str) -> Result<WasmVcfDataset> {
    if vcf_bytes.is_empty() {
        return Err(PlasmidCoreError::VcfParse(
            "VCF file buffer is empty".to_string(),
        ));
    }

    let uncompressed_cow: Cow<'_, [u8]> = if is_gzip_magic(vcf_bytes) {
        let decompressed = decompress_gzip_bounded(vcf_bytes, MAX_VCF_DECOMPRESSED_BYTES)
            .map_err(|e| PlasmidCoreError::VcfParse(format!("Invalid .vcf.gz stream: {e}")))?;
        if decompressed.is_empty() {
            return Err(PlasmidCoreError::VcfParse(
                "Decompressed .vcf.gz stream is empty".to_string(),
            ));
        }
        Cow::Owned(decompressed)
    } else {
        let trimmed = match vcf_bytes.iter().rposition(|&b| b != 0) {
            Some(last) => &vcf_bytes[..=last],
            None => {
                return Err(PlasmidCoreError::VcfParse(
                    "VCF file buffer contains only null bytes".to_string(),
                ));
            }
        };
        Cow::Borrowed(trimmed)
    };

    let text = std::str::from_utf8(&uncompressed_cow)
        .map_err(|_| PlasmidCoreError::VcfParse("Invalid UTF-8 in VCF file".to_string()))?;

    let has_vcf_header = text.lines().any(|l| {
        let t = l.trim();
        t.starts_with("##fileformat=VCF") || t.starts_with("#CHROM\t") || t.starts_with("# rsid\t")
    });

    let mut variants = VcfDecoder::decode_slice(&uncompressed_cow)?;
    if !has_vcf_header && variants.is_empty() {
        return Err(PlasmidCoreError::VcfParse(
            "Input contains no valid VCF header or variant records".to_string(),
        ));
    }

    let reference_build = infer_vcf_reference_build(text, &variants, assembly_hint);
    let chrom_index = build_chrom_coordinate_index(&mut variants);

    let mut pyramid = PyramidIndex::new(&reference_build);
    for v in &variants {
        pyramid.ingest_variant(&v.chrom, v);
    }

    Ok(WasmVcfDataset {
        reference_build,
        byte_length: vcf_bytes.len(),
        sha256_hex: hex_encode(&hash_leaf(vcf_bytes)),
        pyramid,
        chrom_index,
        variants,
    })
}

pub fn parse_local_plasmid_dto(container_bytes: &[u8]) -> Result<WasmLocalPlasmidDataset> {
    if container_bytes.len() < HEADER_SIZE {
        return Err(PlasmidCoreError::Serialization(format!(
            "Buffer length ({}) is shorter than 128-byte .plasmid header",
            container_bytes.len()
        )));
    }

    let header = parse_header_dto(&container_bytes[..HEADER_SIZE])?;
    let payload_start = header.payload_offset as usize;
    let payload_end = payload_start.saturating_add(header.total_payload_bytes as usize);
    if payload_end > container_bytes.len() {
        return Err(PlasmidCoreError::Serialization(format!(
            "Container truncated: expected payload end at byte {}, found {} bytes",
            payload_end,
            container_bytes.len()
        )));
    }

    let merkle = if header.total_payload_bytes == 0 {
        let empty_tree = MerkleTree::from_leaves(Vec::new());
        let calc = hex_encode(&empty_tree.root());
        WasmMerkleVerification {
            verified: calc.eq_ignore_ascii_case(&header.root_hash_hex),
            expected_root_hex: header.root_hash_hex.clone(),
            calculated_root_hex: calc,
            total_chunks: 0,
            verified_bytes: 0,
            chunk_hashes: Vec::new(),
        }
    } else {
        verify_merkle_tree_dto(
            &container_bytes[payload_start..payload_end],
            header.chunk_size,
            &header.root_hash_hex,
        )?
    };

    let mut reader = PlasmidReader::new(Cursor::new(container_bytes))?;
    let metadata_json = reader.metadata_json.clone();
    let leaves: Vec<WasmLeafPointerInfo> = reader
        .root_directory
        .as_ref()
        .map(|r| r.leaves.iter().copied().map(Into::into).collect())
        .unwrap_or_default();

    let raw_entries = reader.read_all_entries()?;
    let mut variants = Vec::new();
    let mut entries = Vec::with_capacity(raw_entries.len());

    for entry in raw_entries {
        if entry.entry_type == EntryType::VcfVariant {
            let payload = reader.read_entry_payload(&entry)?;
            let mut decoded = VcfDecoder::decode_slice(&payload)?;
            variants.append(&mut decoded);
        }
        entries.push(WasmIndexEntryInfo {
            chrom_id: entry.chrom_id,
            chrom_name: id_to_chrom(entry.chrom_id),
            entry,
        });
    }

    let chrom_index = build_chrom_coordinate_index(&mut variants);

    let embedded_pyramid = serde_json::from_str::<serde_json::Value>(&metadata_json)
        .ok()
        .and_then(|v| v.get("pyramid").cloned())
        .and_then(|p| serde_json::from_value::<PyramidIndex>(p).ok());

    let pyramid = match embedded_pyramid {
        Some(pyr) => pyr,
        None => {
            let mut pyr = PyramidIndex::new(&header.reference_build);
            for v in &variants {
                pyr.ingest_variant(&v.chrom, v);
            }
            pyr
        }
    };

    Ok(WasmLocalPlasmidDataset {
        header,
        metadata_json,
        merkle,
        pyramid,
        chrom_index,
        leaves,
        entries,
        variants,
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

    /// Parses an arbitrary local .vcf/.txt byte buffer into a sorted variant table, chromosome coordinate index, and 1Mb PyramidIndex.
    #[wasm_bindgen]
    pub fn parse_vcf_dataset(
        vcf_bytes: &[u8],
        assembly_hint: &str,
    ) -> std::result::Result<JsValue, JsValue> {
        let dataset = parse_vcf_dataset_dto(vcf_bytes, assembly_hint)
            .map_err(|e| JsValue::from_str(&format!("VCF dataset parse error: {e}")))?;
        to_js_json(&dataset)
    }

    /// Parses and cryptographically validates a local .plasmid container buffer stored in OPFS.
    #[wasm_bindgen]
    pub fn parse_local_plasmid(container_bytes: &[u8]) -> std::result::Result<JsValue, JsValue> {
        let dataset = parse_local_plasmid_dto(container_bytes)
            .map_err(|e| JsValue::from_str(&format!("Local .plasmid parse error: {e}")))?;
        to_js_json(&dataset)
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

    /// Generates BEP 52 SHA-256 Merkle audit proofs for requested chunk indices.
    #[wasm_bindgen]
    pub fn generate_chunk_proofs(
        payload_bytes: &[u8],
        chunk_size: u32,
        chunk_indices: &[u32],
    ) -> std::result::Result<JsValue, JsValue> {
        let bundles = generate_chunk_proofs_dto(payload_bytes, chunk_size, chunk_indices)
            .map_err(|e| JsValue::from_str(&format!("Merkle proof generation error: {e}")))?;
        to_js_json(&bundles)
    }

    /// Verifies a single 16KB P2P chunk against the container header's BEP 52 Merkle root and proof path.
    #[wasm_bindgen]
    pub fn verify_merkle_chunk_proof(
        chunk_bytes: &[u8],
        chunk_index: u32,
        total_chunks: f64,
        chunk_size: u32,
        expected_root_hex: &str,
        proof_json: &str,
    ) -> std::result::Result<JsValue, JsValue> {
        let proof: Vec<WasmMerkleProofStep> = serde_json::from_str(proof_json)
            .map_err(|e| JsValue::from_str(&format!("Proof JSON error: {e}")))?;
        let res = verify_merkle_chunk_proof_dto(
            chunk_bytes,
            chunk_index,
            total_chunks as u64,
            chunk_size,
            expected_root_hex,
            &proof,
        )
        .map_err(|e| JsValue::from_str(&format!("Chunk proof verification error: {e}")))?;
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

    /// Verifies locus coordinate & allele consistency against authoritative VCF/FASTA data without synthetic strings.
    #[wasm_bindgen]
    #[allow(clippy::too_many_arguments)]
    pub fn verify_locus_consistency(
        rsid: &str,
        chrom: &str,
        queried_pos: f64,
        asserted_ref: &str,
        authoritative_pos: f64,
        authoritative_ref: &str,
        reference_slice: Option<String>,
        slice_start_pos: f64,
        target_build: &str,
    ) -> std::result::Result<bool, JsValue> {
        let build = if target_build.contains("37") || target_build.contains("19") {
            GenomeBuild::GRCh37
        } else {
            GenomeBuild::GRCh38
        };
        CoordinateGuard::verify_locus_consistency(
            rsid,
            chrom,
            queried_pos as u64,
            asserted_ref,
            authoritative_pos as u64,
            authoritative_ref,
            reference_slice.as_deref(),
            slice_start_pos as u64,
            build,
        )
        .map(|_| true)
        .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Plans minimal hierarchical Leaf Directory HTTP Range requests for personal DNA ↔ ClinVar intersection.
    #[wasm_bindgen]
    pub fn plan_intersection_leaves(
        root_dir_bytes: &[u8],
        personal_variants_json: &str,
        personal_build: &str,
        clinvar_build: &str,
    ) -> std::result::Result<JsValue, JsValue> {
        let personal: Vec<VcfVariantRecord> = serde_json::from_str(personal_variants_json)
            .map_err(|e| JsValue::from_str(&format!("Personal variants JSON error: {e}")))?;
        let plan =
            plan_intersection_leaves_dto(root_dir_bytes, &personal, personal_build, clinvar_build)
                .map_err(|e| JsValue::from_str(&format!("Intersection leaf plan error: {e}")))?;
        to_js_json(&plan)
    }

    /// Plans minimal 16KB Zstd chunk HTTP Range requests for personal DNA ↔ ClinVar intersection.
    #[wasm_bindgen]
    pub fn plan_intersection_chunks(
        directory_bytes: &[u8],
        personal_variants_json: &str,
        personal_build: &str,
        clinvar_build: &str,
        payload_offset: f64,
        chunk_size: u32,
    ) -> std::result::Result<JsValue, JsValue> {
        let personal: Vec<VcfVariantRecord> = serde_json::from_str(personal_variants_json)
            .map_err(|e| JsValue::from_str(&format!("Personal variants JSON error: {e}")))?;
        let plan = plan_intersection_chunks_dto(
            directory_bytes,
            &personal,
            personal_build,
            clinvar_build,
            payload_offset as u64,
            chunk_size,
        )
        .map_err(|e| JsValue::from_str(&format!("Intersection chunk plan error: {e}")))?;
        to_js_json(&plan)
    }

    /// Intersects local OPFS personal variants against sliced ClinVar `.plasmid` Zstd chunks in WebAssembly.
    #[wasm_bindgen]
    pub fn intersect_personal_with_clinvar(
        personal_variants_json: &str,
        personal_build: &str,
        entries_json: &str,
        chunks_concat: &[u8],
        chunk_indices: &[u32],
        chunk_size: u32,
        clinvar_build: &str,
    ) -> std::result::Result<JsValue, JsValue> {
        let personal: Vec<VcfVariantRecord> = serde_json::from_str(personal_variants_json)
            .map_err(|e| JsValue::from_str(&format!("Personal variants JSON error: {e}")))?;
        let entries: Vec<PlasmidIndexEntry> = serde_json::from_str(entries_json)
            .map_err(|e| JsValue::from_str(&format!("Entries JSON error: {e}")))?;
        let res = intersect_personal_with_clinvar_dto(
            &personal,
            personal_build,
            &entries,
            chunks_concat,
            chunk_indices,
            chunk_size,
            clinvar_build,
        )
        .map_err(|e| JsValue::from_str(&format!("ClinVar intersection error: {e}")))?;
        to_js_json(&res)
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

    #[test]
    fn test_parse_vcf_dataset_dto_and_rejection() {
        let custom_vcf = concat!(
            "##fileformat=VCFv4.3\n",
            "##reference=GRCh37\n",
            "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSAMPLE1\n",
            "12\t112241766\trs671\tG\tA\t99\tPASS\tGENE=ALDH2;CLNSIG=Risk_factor\tGT:DP\t0/1:51\n",
            "6\t26093141\trs1800562\tG\tA\t98\tPASS\tGENE=HFE;CLNSIG=Pathogenic;AA=p.Cys282Tyr\tGT:DP\t1/1:64\n",
            "chr6\t26091179\trs1799945\tC\tG\t92\tPASS\tGENE=HFE;CLNSIG=Uncertain_significance\tGT:DP\t0/1:44\n"
        );

        let dataset = parse_vcf_dataset_dto(custom_vcf.as_bytes(), "GRCh38").unwrap();
        assert_eq!(dataset.reference_build, "GRCh37");
        assert_eq!(dataset.byte_length, custom_vcf.len());
        assert_eq!(dataset.sha256_hex.len(), 64);
        assert_eq!(dataset.variants.len(), 3);
        assert_eq!(dataset.pyramid.total_variants, 3);
        assert_eq!(dataset.pyramid.total_pathogenic, 1);

        // Sorted by chrom_id (chr6 before chr12) and pos ascending
        assert_eq!(dataset.chrom_index.len(), 2);
        assert_eq!(dataset.chrom_index[0].chrom_name, "chr6");
        assert_eq!(dataset.chrom_index[0].min_pos, 26091179);
        assert_eq!(dataset.chrom_index[0].max_pos, 26093141);
        assert_eq!(dataset.chrom_index[0].variant_count, 2);
        assert_eq!(dataset.chrom_index[0].pathogenic_count, 1);
        assert_eq!(dataset.chrom_index[0].start_index, 0);
        assert_eq!(dataset.chrom_index[0].end_index, 1);

        assert_eq!(dataset.chrom_index[1].chrom_name, "chr12");
        assert_eq!(dataset.chrom_index[1].variant_count, 1);
        assert_eq!(dataset.chrom_index[1].start_index, 2);
        assert_eq!(dataset.chrom_index[1].end_index, 2);

        // Garbage non-VCF text must fail closed
        assert!(parse_vcf_dataset_dto(b"not a vcf file at all", "GRCh38").is_err());
        assert!(parse_vcf_dataset_dto(b"", "GRCh38").is_err());
        assert!(
            parse_vcf_dataset_dto("chr7\t100\trs1\t유전자\t변이\n".as_bytes(), "GRCh38").is_err()
        );

        // 23andMe .txt build 37 detection (via comment header and via coordinate guard)
        let raw_23andme = concat!(
            "# This data file generated by 23andMe, reference human assembly build 37\n",
            "# rsid\tchromosome\tposition\tgenotype\n",
            "rs334\t11\t5248232\tTA\n",
            "rs113488022\t7\t140453136\tAT\n"
        );
        let parsed_23 = parse_vcf_dataset_dto(raw_23andme.as_bytes(), "GRCh38").unwrap();
        assert_eq!(parsed_23.reference_build, "GRCh37");
        assert_eq!(parsed_23.variants.len(), 2);

        let raw_23_no_comment = concat!(
            "# rsid\tchromosome\tposition\tgenotype\n",
            "rs334\t11\t5248232\tTA\n",
            "rs113488022\t7\t140453136\tAT\n"
        );
        let parsed_23_auto = parse_vcf_dataset_dto(raw_23_no_comment.as_bytes(), "GRCh38").unwrap();
        assert_eq!(parsed_23_auto.reference_build, "GRCh37");
    }

    #[test]
    fn test_parse_local_plasmid_dto_hierarchical_and_flat() {
        let mut builder = PlasmidBuilder::new("GRCh38");
        builder.set_metadata(r#"{"license":"Private Vault"}"#);
        builder.add_item(
            1,
            EntryType::VcfVariant,
            55051215,
            55051215,
            b"chr1\t55051215\trs28362286\tC\tA\t99\tPASS\tGENE=PCSK9;CLNSIG=Pathogenic\n".to_vec(),
        );
        builder.add_item(
            12,
            EntryType::VcfVariant,
            111803962,
            111803962,
            b"chr12\t111803962\trs671\tG\tA\t100\tPASS\tGENE=ALDH2;CLNSIG=Risk_factor\n".to_vec(),
        );

        let mut container = Vec::new();
        builder.build_hierarchical(&mut container, 1).unwrap();

        let parsed = parse_local_plasmid_dto(&container).unwrap();
        assert!(parsed.header.is_hierarchical);
        assert!(parsed.merkle.verified);
        assert_eq!(parsed.variants.len(), 2);
        assert_eq!(parsed.pyramid.total_variants, 2);
        assert_eq!(parsed.pyramid.total_pathogenic, 1);
        assert_eq!(parsed.chrom_index.len(), 2);
        assert_eq!(parsed.chrom_index[0].chrom_name, "chr1");
        assert_eq!(parsed.chrom_index[1].chrom_name, "chr12");
    }

    #[test]
    fn test_merkle_chunk_proof_generation_and_byzantine_rejection() {
        let mut builder = PlasmidBuilder::new("GRCh38");
        for i in 0..5u64 {
            builder.add_item(
                1,
                EntryType::VcfVariant,
                10_000 + i * 1_000,
                10_000 + i * 1_000,
                format!(
                    "chr1\t{}\trs{}\tA\tG\t99\tPASS\tGENE=TEST\n",
                    10_000 + i * 1_000,
                    i
                )
                .into_bytes(),
            );
        }

        let mut container = Vec::new();
        builder.build_hierarchical(&mut container, 2).unwrap();
        let header = parse_header_dto(&container[0..128]).unwrap();
        assert_eq!(header.total_chunks, 5); // odd chunk count exercises trailing node duplication
        let payload = &container[header.payload_offset as usize..];
        let csize = header.chunk_size as usize;

        let bundles = generate_chunk_proofs_dto(payload, header.chunk_size, &[0, 2, 4]).unwrap();
        assert_eq!(bundles.len(), 3);

        for b in &bundles {
            let idx = b.chunk_index as usize;
            let chunk_slice = &payload[idx * csize..(idx + 1) * csize];
            let res = verify_merkle_chunk_proof_dto(
                chunk_slice,
                b.chunk_index,
                header.total_chunks,
                header.chunk_size,
                &header.root_hash_hex,
                &b.proof,
            )
            .unwrap();
            assert!(res.verified, "Chunk {} must verify cleanly", b.chunk_index);
            assert_eq!(res.calculated_root_hex, header.root_hash_hex);
        }

        // 1. Tampered byte in chunk #0 must fail verification
        let mut tampered = payload[0..csize].to_vec();
        tampered[0] ^= 0xff;
        let bad_bytes = verify_merkle_chunk_proof_dto(
            &tampered,
            0,
            header.total_chunks,
            header.chunk_size,
            &header.root_hash_hex,
            &bundles[0].proof,
        )
        .unwrap();
        assert!(!bad_bytes.verified);

        // 2. Index-swap attack: sending valid chunk #0 + proof #0 while claiming chunk_index = 1 must fail topology check
        let swapped_idx = verify_merkle_chunk_proof_dto(
            &payload[0..csize],
            1,
            header.total_chunks,
            header.chunk_size,
            &header.root_hash_hex,
            &bundles[0].proof,
        )
        .unwrap();
        assert!(!swapped_idx.verified);

        // 3. Truncated proof must fail depth check
        let truncated = verify_merkle_chunk_proof_dto(
            &payload[0..csize],
            0,
            header.total_chunks,
            header.chunk_size,
            &header.root_hash_hex,
            &bundles[0].proof[..1],
        )
        .unwrap();
        assert!(!truncated.verified);
    }
}
