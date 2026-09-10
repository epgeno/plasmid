//! # plasmid-format
//!
//! Specification and binary container codec for `.plasmid` genomic archive files.
//! Implements multi-resolution genomic tile chunking with BitTorrent v2 compatible Merkle trees.

pub const PLASMID_MAGIC: &[u8; 8] = b"PLASMID\x01";
pub const DEFAULT_CHUNK_SIZE: usize = 16 * 1024; // 16 KB matching BitTorrent v2 BEP 52

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PlasmidHeader {
    pub magic: [u8; 8],
    pub version: u16,
    pub reference_build: String, // e.g., "GRCh38"
    pub root_hash: [u8; 32],
    pub chunk_size: u32,
    pub total_chunks: u64,
}

impl Default for PlasmidHeader {
    fn default() -> Self {
        Self {
            magic: *PLASMID_MAGIC,
            version: 1,
            reference_build: "GRCh38".to_string(),
            root_hash: [0u8; 32],
            chunk_size: DEFAULT_CHUNK_SIZE as u32,
            total_chunks: 0,
        }
    }
}
