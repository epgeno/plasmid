//! # plasmid-core
//!
//! Core range-query coordinator and decoder abstractions for streaming genomic features.

pub use plasmid_format::*;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GenomicCoordinate {
    pub chromosome: String,
    pub start: u64,
    pub end: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Invalid coordinate: {0}:{1}-{2}")]
    InvalidCoordinate(String, u64, u64),
    #[error("Chunk not found at index: {0}")]
    ChunkNotFound(u64),
}
