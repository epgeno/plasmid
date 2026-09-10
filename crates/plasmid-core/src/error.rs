use thiserror::Error;

#[derive(Error, Debug)]
pub enum PlasmidCoreError {
    #[error("Format error: {0}")]
    Format(#[from] plasmid_format::PlasmidFormatError),

    #[error("Unknown chromosome identifier: {0}")]
    UnknownChromosome(String),

    #[error("Invalid genomic coordinate range: {start}..={end}")]
    InvalidCoordinateRange { start: u64, end: u64 },

    #[error("VCF parsing error: {0}")]
    VcfParse(String),

    #[error("FASTA reference parsing error: {0}")]
    FastaParse(String),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Merkle verification error: {0}")]
    MerkleVerification(String),
}

pub type Result<T> = std::result::Result<T, PlasmidCoreError>;
