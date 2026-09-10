use thiserror::Error;

#[derive(Error, Debug)]
pub enum PlasmidFormatError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Invalid magic bytes: expected {expected:?}, found {found:?}")]
    InvalidMagic { expected: [u8; 8], found: [u8; 8] },

    #[error("Unsupported format version: {0}")]
    UnsupportedVersion(u16),

    #[error("Header size too small: expected 128 bytes, got {0}")]
    HeaderTooSmall(usize),

    #[error("Merkle root mismatch: expected {expected}, calculated {calculated}")]
    MerkleRootMismatch {
        expected: String,
        calculated: String,
    },

    #[error("Chunk index out of bounds: {0} >= {1}")]
    ChunkIndexOutOfBounds(u64, u64),

    #[error("Corrupted directory index")]
    CorruptedIndex,

    #[error("Serialization error: {0}")]
    Serialization(String),
}

pub type Result<T> = std::result::Result<T, PlasmidFormatError>;
