use crate::error::{PlasmidFormatError, Result};
use std::io::{Read, Write};

pub const PLASMID_MAGIC: &[u8; 8] = b"PLASMID\x01";
pub const HEADER_SIZE: usize = 128;
pub const CURRENT_VERSION: u16 = 1;
pub const DEFAULT_CHUNK_SIZE: u32 = 16 * 1024; // 16,384 bytes (BitTorrent v2 BEP 52)

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlasmidHeader {
    pub version: u16,
    pub flags: u16,
    pub reference_build: String,
    pub root_hash: [u8; 32],
    pub chunk_size: u32,
    pub total_chunks: u64,
    pub total_payload_bytes: u64,
    pub index_offset: u64,
    pub index_length: u64,
    pub metadata_offset: u64,
    pub metadata_length: u64,
}

impl Default for PlasmidHeader {
    fn default() -> Self {
        Self {
            version: CURRENT_VERSION,
            flags: 0,
            reference_build: "GRCh38".to_string(),
            root_hash: [0u8; 32],
            chunk_size: DEFAULT_CHUNK_SIZE,
            total_chunks: 0,
            total_payload_bytes: 0,
            index_offset: HEADER_SIZE as u64,
            index_length: 0,
            metadata_offset: 0,
            metadata_length: 0,
        }
    }
}

impl PlasmidHeader {
    pub fn serialize(&self) -> [u8; HEADER_SIZE] {
        let mut buf = [0u8; HEADER_SIZE];
        buf[0..8].copy_from_slice(PLASMID_MAGIC);
        buf[8..10].copy_from_slice(&self.version.to_le_bytes());
        buf[10..12].copy_from_slice(&self.flags.to_le_bytes());

        // 16-byte reference build (null padded)
        let build_bytes = self.reference_build.as_bytes();
        let copy_len = build_bytes.len().min(16);
        buf[12..12 + copy_len].copy_from_slice(&build_bytes[..copy_len]);

        buf[28..60].copy_from_slice(&self.root_hash);
        buf[60..64].copy_from_slice(&self.chunk_size.to_le_bytes());
        buf[64..72].copy_from_slice(&self.total_chunks.to_le_bytes());
        buf[72..80].copy_from_slice(&self.total_payload_bytes.to_le_bytes());
        buf[80..88].copy_from_slice(&self.index_offset.to_le_bytes());
        buf[88..96].copy_from_slice(&self.index_length.to_le_bytes());
        buf[96..104].copy_from_slice(&self.metadata_offset.to_le_bytes());
        buf[104..112].copy_from_slice(&self.metadata_length.to_le_bytes());

        // Remaining 16 bytes (112..128) remain 0 as reserved
        buf
    }

    pub fn write_to<W: Write>(&self, mut writer: W) -> Result<()> {
        let bytes = self.serialize();
        writer.write_all(&bytes)?;
        Ok(())
    }

    pub fn deserialize(buf: &[u8]) -> Result<Self> {
        if buf.len() < HEADER_SIZE {
            return Err(PlasmidFormatError::HeaderTooSmall(buf.len()));
        }

        let mut magic = [0u8; 8];
        magic.copy_from_slice(&buf[0..8]);
        if &magic != PLASMID_MAGIC {
            return Err(PlasmidFormatError::InvalidMagic {
                expected: *PLASMID_MAGIC,
                found: magic,
            });
        }

        let version = u16::from_le_bytes([buf[8], buf[9]]);
        if version != CURRENT_VERSION {
            return Err(PlasmidFormatError::UnsupportedVersion(version));
        }

        let flags = u16::from_le_bytes([buf[10], buf[11]]);

        // Read null-terminated or full 16-byte string
        let build_slice = &buf[12..28];
        let build_end = build_slice.iter().position(|&b| b == 0).unwrap_or(16);
        let reference_build = String::from_utf8_lossy(&build_slice[..build_end]).to_string();

        let mut root_hash = [0u8; 32];
        root_hash.copy_from_slice(&buf[28..60]);

        let chunk_size = u32::from_le_bytes(buf[60..64].try_into().unwrap());
        let total_chunks = u64::from_le_bytes(buf[64..72].try_into().unwrap());
        let total_payload_bytes = u64::from_le_bytes(buf[72..80].try_into().unwrap());
        let index_offset = u64::from_le_bytes(buf[80..88].try_into().unwrap());
        let index_length = u64::from_le_bytes(buf[88..96].try_into().unwrap());
        let metadata_offset = u64::from_le_bytes(buf[96..104].try_into().unwrap());
        let metadata_length = u64::from_le_bytes(buf[104..112].try_into().unwrap());

        Ok(Self {
            version,
            flags,
            reference_build,
            root_hash,
            chunk_size,
            total_chunks,
            total_payload_bytes,
            index_offset,
            index_length,
            metadata_offset,
            metadata_length,
        })
    }

    pub fn read_from<R: Read>(mut reader: R) -> Result<Self> {
        let mut buf = [0u8; HEADER_SIZE];
        reader.read_exact(&mut buf)?;
        Self::deserialize(&buf)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_header_roundtrip() {
        let header = PlasmidHeader {
            reference_build: "T2T-CHM13v2".to_string(),
            root_hash: [0xab; 32],
            total_chunks: 42,
            total_payload_bytes: 42 * 16384,
            index_offset: 128,
            index_length: 1024,
            ..Default::default()
        };

        let serialized = header.serialize();
        assert_eq!(serialized.len(), 128);

        let deserialized = PlasmidHeader::deserialize(&serialized).unwrap();
        assert_eq!(header, deserialized);
    }
}
