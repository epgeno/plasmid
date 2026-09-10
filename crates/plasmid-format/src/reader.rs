use crate::error::{PlasmidFormatError, Result};
use crate::header::PlasmidHeader;
use crate::index::{EntryType, PlasmidDirectory, PlasmidIndexEntry};
use crate::merkle::MerkleTree;
use std::io::{Read, Seek, SeekFrom};

pub struct PlasmidReader<R> {
    reader: R,
    pub header: PlasmidHeader,
    pub directory: PlasmidDirectory,
    pub metadata_json: String,
    payload_start_offset: u64,
}

impl<R: Read + Seek> PlasmidReader<R> {
    pub fn new(mut reader: R) -> Result<Self> {
        // 1. Read 128-byte header
        reader.seek(SeekFrom::Start(0))?;
        let header = PlasmidHeader::read_from(&mut reader)?;

        // 2. Read directory index
        reader.seek(SeekFrom::Start(header.index_offset))?;
        let mut index_bytes = vec![0u8; header.index_length as usize];
        reader.read_exact(&mut index_bytes)?;
        let directory = PlasmidDirectory::deserialize(&index_bytes)?;

        // 3. Read metadata JSON
        let metadata_json = if header.metadata_length > 0 {
            reader.seek(SeekFrom::Start(header.metadata_offset))?;
            let mut meta_bytes = vec![0u8; header.metadata_length as usize];
            reader.read_exact(&mut meta_bytes)?;
            String::from_utf8_lossy(&meta_bytes).to_string()
        } else {
            "{}".to_string()
        };

        let payload_start_offset = header.metadata_offset + header.metadata_length;

        Ok(Self {
            reader,
            header,
            directory,
            metadata_json,
            payload_start_offset,
        })
    }

    /// Read raw 16KB chunk by index
    pub fn read_chunk(&mut self, chunk_idx: u32) -> Result<Vec<u8>> {
        if chunk_idx as u64 >= self.header.total_chunks {
            return Err(PlasmidFormatError::ChunkIndexOutOfBounds(
                chunk_idx as u64,
                self.header.total_chunks,
            ));
        }

        let offset = self.payload_start_offset + (chunk_idx as u64 * self.header.chunk_size as u64);
        self.reader.seek(SeekFrom::Start(offset))?;

        let mut buf = vec![0u8; self.header.chunk_size as usize];
        self.reader.read_exact(&mut buf)?;
        Ok(buf)
    }

    /// Reads payload for a given index entry
    pub fn read_entry_payload(&mut self, entry: &PlasmidIndexEntry) -> Result<Vec<u8>> {
        let mut combined = Vec::with_capacity(entry.payload_bytes as usize);
        for c in 0..entry.chunk_count {
            let chunk_data = self.read_chunk(entry.chunk_start + c)?;
            combined.extend_from_slice(&chunk_data);
        }
        combined.truncate(entry.payload_bytes as usize);
        Ok(combined)
    }

    /// Range query genomic coordinates
    pub fn query(
        &self,
        chrom_id: u16,
        start_pos: u64,
        end_pos: u64,
        filter_type: Option<EntryType>,
    ) -> Vec<PlasmidIndexEntry> {
        self.directory
            .query_range(chrom_id, start_pos, end_pos, filter_type)
    }

    /// Verifies entire file payload against root Merkle hash
    pub fn verify_integrity(&mut self) -> Result<bool> {
        let mut chunks = Vec::with_capacity(self.header.total_chunks as usize);
        for i in 0..self.header.total_chunks as u32 {
            chunks.push(self.read_chunk(i)?);
        }
        let chunk_slices: Vec<&[u8]> = chunks.iter().map(|c| c.as_slice()).collect();
        let tree = MerkleTree::from_chunks(&chunk_slices);
        Ok(tree.root() == self.header.root_hash)
    }
}
