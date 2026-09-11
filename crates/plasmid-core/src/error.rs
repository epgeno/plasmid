use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoordinateDriftDetails {
    pub rsid: String,
    pub chrom: String,
    pub pos: u64,
    pub found: String,
    pub expected: String,
    pub target_build: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnmappedCoordinateDetails {
    pub chrom: String,
    pub pos: u64,
    pub src_build: String,
    pub dst_build: String,
}

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

    #[error("Coordinate drift mismatch: variant {0:?}")]
    CoordinateDriftMismatch(Box<CoordinateDriftDetails>),

    #[error("Unmapped coordinate: {0:?}")]
    UnmappedCoordinate(Box<UnmappedCoordinateDetails>),
}

pub type Result<T> = std::result::Result<T, PlasmidCoreError>;
