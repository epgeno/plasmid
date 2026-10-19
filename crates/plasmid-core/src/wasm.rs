#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
use crate::decoder::{AnnotationDecoder, FastaDecoder, VcfDecoder};
#[cfg(feature = "wasm")]
use crate::liftover::{CoordinateGuard, GenomeBuild, LiftoverEngine};
#[cfg(feature = "wasm")]
use crate::slicing::RangePlanner;
#[cfg(feature = "wasm")]
use plasmid_format::{PlasmidDirectory, hash_leaf};

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub struct PlasmidWasmEngine;

#[cfg(feature = "wasm")]
#[wasm_bindgen]
impl PlasmidWasmEngine {
    /// Plans minimal HTTP Range Requests from a downloaded .plasmid directory index.
    #[wasm_bindgen]
    pub fn plan_range_slice(
        directory_bytes: &[u8],
        chrom: &str,
        start_pos: f64,
        end_pos: f64,
        payload_offset: f64,
        chunk_size: u32,
    ) -> std::result::Result<JsValue, JsValue> {
        let directory = PlasmidDirectory::deserialize(directory_bytes)
            .map_err(|e| JsValue::from_str(&format!("Directory parse error: {e}")))?;

        let plan = RangePlanner::plan_slice(
            &directory,
            chrom,
            start_pos as u64,
            end_pos as u64,
            None,
            payload_offset as u64,
            chunk_size,
        )
        .map_err(|e| JsValue::from_str(&format!("Planning error: {e}")))?;

        serde_wasm_bindgen::to_value(&plan)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {e}")))
    }

    /// Zero-copy decode of a VCF variant chunk downloaded via HTTP Range or P2P WebRTC.
    #[wasm_bindgen]
    pub fn decode_vcf_chunk(chunk_bytes: &[u8]) -> std::result::Result<JsValue, JsValue> {
        let variants = VcfDecoder::decode_slice(chunk_bytes)
            .map_err(|e| JsValue::from_str(&format!("VCF decode error: {e}")))?;

        serde_wasm_bindgen::to_value(&variants)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {e}")))
    }

    /// Decodes ClinVar/Wiki markdown annotations and ACMG rules from an annotation chunk.
    #[wasm_bindgen]
    pub fn decode_annotation_chunk(chunk_bytes: &[u8]) -> std::result::Result<JsValue, JsValue> {
        let annotation = AnnotationDecoder::decode(chunk_bytes)
            .map_err(|e| JsValue::from_str(&format!("Annotation decode error: {e}")))?;

        serde_wasm_bindgen::to_value(&annotation)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {e}")))
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

    /// Verifies SHA-256 integrity of a downloaded chunk against an expected 32-byte hash.
    #[wasm_bindgen]
    pub fn verify_chunk_hash(chunk_bytes: &[u8], expected_hash: &[u8]) -> bool {
        if expected_hash.len() != 32 {
            return false;
        }
        let computed = hash_leaf(chunk_bytes);
        computed.as_slice() == expected_hash
    }

    /// Allocates linear memory buffer for zero-copy streaming from JS into WebAssembly.
    #[wasm_bindgen]
    pub fn alloc_buffer(size: usize) -> *mut u8 {
        let mut buf = Vec::with_capacity(size);
        let ptr = buf.as_mut_ptr();
        std::mem::forget(buf);
        ptr
    }

    /// Deallocates memory buffer previously allocated by alloc_buffer.
    #[wasm_bindgen]
    pub fn free_buffer(ptr: *mut u8, size: usize) {
        unsafe {
            let _ = Vec::from_raw_parts(ptr, 0, size);
        }
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

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {e}")))
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
