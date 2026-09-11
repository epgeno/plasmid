use crate::error::{PlasmidFormatError, Result};
use serde::{Deserialize, Serialize};

pub const INDEX_ENTRY_SIZE: usize = 32;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum EntryType {
    ReferenceFasta = 0,
    CramAlignment = 1,
    VcfVariant = 2,
    ClinVarAnnotation = 3,
    WikiMarkdown = 4,
}

impl TryFrom<u8> for EntryType {
    type Error = PlasmidFormatError;

    fn try_from(val: u8) -> Result<Self> {
        match val {
            0 => Ok(EntryType::ReferenceFasta),
            1 => Ok(EntryType::CramAlignment),
            2 => Ok(EntryType::VcfVariant),
            3 => Ok(EntryType::ClinVarAnnotation),
            4 => Ok(EntryType::WikiMarkdown),
            _ => Err(PlasmidFormatError::CorruptedIndex),
        }
    }
}

/// Fixed 32-byte directory entry mapping genomic coordinates to 16KB Merkle chunks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlasmidIndexEntry {
    pub chrom_id: u16,
    pub entry_type: EntryType,
    pub flags: u8,
    pub start_pos: u64,
    pub end_pos: u64,
    pub chunk_start: u32,
    pub chunk_count: u32,
    pub payload_bytes: u32,
}

impl PlasmidIndexEntry {
    pub fn serialize(&self) -> [u8; INDEX_ENTRY_SIZE] {
        let mut buf = [0u8; INDEX_ENTRY_SIZE];
        buf[0..2].copy_from_slice(&self.chrom_id.to_le_bytes());
        buf[2] = self.entry_type as u8;
        buf[3] = self.flags;
        buf[4..12].copy_from_slice(&self.start_pos.to_le_bytes());
        buf[12..20].copy_from_slice(&self.end_pos.to_le_bytes());
        buf[20..24].copy_from_slice(&self.chunk_start.to_le_bytes());
        buf[24..28].copy_from_slice(&self.chunk_count.to_le_bytes());
        buf[28..32].copy_from_slice(&self.payload_bytes.to_le_bytes());
        buf
    }

    pub fn deserialize(buf: &[u8]) -> Result<Self> {
        if buf.len() < INDEX_ENTRY_SIZE {
            return Err(PlasmidFormatError::CorruptedIndex);
        }

        let chrom_id = u16::from_le_bytes([buf[0], buf[1]]);
        let entry_type = EntryType::try_from(buf[2])?;
        let flags = buf[3];
        let start_pos = u64::from_le_bytes(buf[4..12].try_into().unwrap());
        let end_pos = u64::from_le_bytes(buf[12..20].try_into().unwrap());
        let chunk_start = u32::from_le_bytes(buf[20..24].try_into().unwrap());
        let chunk_count = u32::from_le_bytes(buf[24..28].try_into().unwrap());
        let payload_bytes = u32::from_le_bytes(buf[28..32].try_into().unwrap());

        Ok(Self {
            chrom_id,
            entry_type,
            flags,
            start_pos,
            end_pos,
            chunk_start,
            chunk_count,
            payload_bytes,
        })
    }
}

/// Directory index containing sorted genomic entries.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct PlasmidDirectory {
    pub entries: Vec<PlasmidIndexEntry>,
}

impl PlasmidDirectory {
    pub fn new(mut entries: Vec<PlasmidIndexEntry>) -> Self {
        // Sort entries by (chrom_id, start_pos, entry_type)
        entries.sort_by_key(|e| (e.chrom_id, e.start_pos, e.entry_type as u8));
        Self { entries }
    }

    pub fn serialize(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(self.entries.len() * INDEX_ENTRY_SIZE);
        for entry in &self.entries {
            out.extend_from_slice(&entry.serialize());
        }
        out
    }

    pub fn deserialize(bytes: &[u8]) -> Result<Self> {
        if !bytes.len().is_multiple_of(INDEX_ENTRY_SIZE) {
            return Err(PlasmidFormatError::CorruptedIndex);
        }

        let count = bytes.len() / INDEX_ENTRY_SIZE;
        let mut entries = Vec::with_capacity(count);

        for i in 0..count {
            let start = i * INDEX_ENTRY_SIZE;
            let end = start + INDEX_ENTRY_SIZE;
            entries.push(PlasmidIndexEntry::deserialize(&bytes[start..end])?);
        }

        Ok(Self { entries })
    }

    /// Query entries overlapping a specific genomic coordinate range.
    pub fn query_range(
        &self,
        chrom_id: u16,
        start_pos: u64,
        end_pos: u64,
        filter_type: Option<EntryType>,
    ) -> Vec<PlasmidIndexEntry> {
        self.entries
            .iter()
            .filter(|e| {
                e.chrom_id == chrom_id
                    && e.start_pos <= end_pos
                    && e.end_pos >= start_pos
                    && filter_type.is_none_or(|ft| e.entry_type == ft)
            })
            .copied()
            .collect()
    }
}

pub const INDEX_LEAF_POINTER_SIZE: usize = 32;

/// Fixed 32-byte pointer in the Root Directory pointing to an isolated Leaf Directory block.
/// Modeled after PMTiles v3 2-stage hierarchical index to allow ~2KB partial range fetching.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlasmidLeafPointer {
    pub chrom_id: u16,
    pub flags: u16,
    pub min_pos: u64,
    pub max_pos: u64,
    pub leaf_offset: u64,
    pub leaf_length: u32,
    pub entry_count: u32,
}

impl PlasmidLeafPointer {
    pub fn serialize(&self) -> [u8; INDEX_LEAF_POINTER_SIZE] {
        let mut buf = [0u8; INDEX_LEAF_POINTER_SIZE];
        buf[0..2].copy_from_slice(&self.chrom_id.to_le_bytes());
        buf[2..4].copy_from_slice(&self.flags.to_le_bytes());
        buf[4..12].copy_from_slice(&self.min_pos.to_le_bytes());
        buf[12..20].copy_from_slice(&self.max_pos.to_le_bytes());
        buf[20..28].copy_from_slice(&self.leaf_offset.to_le_bytes());
        buf[28..32].copy_from_slice(&self.leaf_length.to_le_bytes());
        buf
    }

    pub fn deserialize(buf: &[u8]) -> Result<Self> {
        if buf.len() < INDEX_LEAF_POINTER_SIZE {
            return Err(PlasmidFormatError::CorruptedIndex);
        }

        let chrom_id = u16::from_le_bytes([buf[0], buf[1]]);
        let flags = u16::from_le_bytes([buf[2], buf[3]]);
        let min_pos = u64::from_le_bytes(buf[4..12].try_into().unwrap());
        let max_pos = u64::from_le_bytes(buf[12..20].try_into().unwrap());
        let leaf_offset = u64::from_le_bytes(buf[20..28].try_into().unwrap());
        let leaf_length = u32::from_le_bytes(buf[28..32].try_into().unwrap());
        let entry_count = leaf_length / INDEX_ENTRY_SIZE as u32;

        Ok(Self {
            chrom_id,
            flags,
            min_pos,
            max_pos,
            leaf_offset,
            leaf_length,
            entry_count,
        })
    }
}

/// Root directory containing pointers to hierarchical leaf directories.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct PlasmidRootDirectory {
    pub leaves: Vec<PlasmidLeafPointer>,
}

impl PlasmidRootDirectory {
    pub fn new(mut leaves: Vec<PlasmidLeafPointer>) -> Self {
        leaves.sort_by_key(|l| (l.chrom_id, l.min_pos));
        Self { leaves }
    }

    pub fn serialize(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(self.leaves.len() * INDEX_LEAF_POINTER_SIZE);
        for leaf in &self.leaves {
            out.extend_from_slice(&leaf.serialize());
        }
        out
    }

    pub fn deserialize(bytes: &[u8]) -> Result<Self> {
        if !bytes.len().is_multiple_of(INDEX_LEAF_POINTER_SIZE) {
            return Err(PlasmidFormatError::CorruptedIndex);
        }

        let count = bytes.len() / INDEX_LEAF_POINTER_SIZE;
        let mut leaves = Vec::with_capacity(count);

        for i in 0..count {
            let start = i * INDEX_LEAF_POINTER_SIZE;
            let end = start + INDEX_LEAF_POINTER_SIZE;
            leaves.push(PlasmidLeafPointer::deserialize(&bytes[start..end])?);
        }

        Ok(Self { leaves })
    }

    /// Finds all leaf pointers overlapping a given genomic coordinate range.
    pub fn find_overlapping_leaves(
        &self,
        chrom_id: u16,
        start_pos: u64,
        end_pos: u64,
    ) -> Vec<PlasmidLeafPointer> {
        self.leaves
            .iter()
            .filter(|l| l.chrom_id == chrom_id && l.min_pos <= end_pos && l.max_pos >= start_pos)
            .copied()
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_directory_index_search() {
        let entries = vec![
            PlasmidIndexEntry {
                chrom_id: 7,
                entry_type: EntryType::ClinVarAnnotation,
                flags: 0,
                start_pos: 140453100,
                end_pos: 140453200,
                chunk_start: 10,
                chunk_count: 1,
                payload_bytes: 4096,
            },
            PlasmidIndexEntry {
                chrom_id: 7,
                entry_type: EntryType::VcfVariant,
                flags: 0,
                start_pos: 140450000,
                end_pos: 140460000,
                chunk_start: 11,
                chunk_count: 2,
                payload_bytes: 32000,
            },
            PlasmidIndexEntry {
                chrom_id: 8,
                entry_type: EntryType::VcfVariant,
                flags: 0,
                start_pos: 1000,
                end_pos: 2000,
                chunk_start: 13,
                chunk_count: 1,
                payload_bytes: 1000,
            },
        ];

        let dir = PlasmidDirectory::new(entries);
        let serialized = dir.serialize();
        assert_eq!(serialized.len(), 3 * INDEX_ENTRY_SIZE);

        let decoded = PlasmidDirectory::deserialize(&serialized).unwrap();
        assert_eq!(dir, decoded);

        // Query BRAF region on chr7
        let results = dir.query_range(7, 140453136, 140453137, None);
        assert_eq!(results.len(), 2);
    }
}
