use crate::error::Result;
use crate::header::{DEFAULT_CHUNK_SIZE, HEADER_SIZE, PlasmidHeader};
use crate::index::{EntryType, PlasmidDirectory, PlasmidIndexEntry};
use crate::merkle::MerkleTree;
use std::io::Write;

pub struct PayloadItem {
    pub chrom_id: u16,
    pub entry_type: EntryType,
    pub flags: u8,
    pub start_pos: u64,
    pub end_pos: u64,
    pub data: Vec<u8>,
}

pub struct PlasmidBuilder {
    reference_build: String,
    metadata_json: String,
    items: Vec<PayloadItem>,
}

impl PlasmidBuilder {
    pub fn new(reference_build: &str) -> Self {
        Self {
            reference_build: reference_build.to_string(),
            metadata_json: "{}".to_string(),
            items: Vec::new(),
        }
    }

    pub fn set_metadata(&mut self, metadata_json: &str) -> &mut Self {
        self.metadata_json = metadata_json.to_string();
        self
    }

    pub fn add_item(
        &mut self,
        chrom_id: u16,
        entry_type: EntryType,
        start_pos: u64,
        end_pos: u64,
        data: Vec<u8>,
    ) -> &mut Self {
        self.items.push(PayloadItem {
            chrom_id,
            entry_type,
            flags: 0,
            start_pos,
            end_pos,
            data,
        });
        self
    }

    /// Builds the .plasmid file into any std::io::Write destination.
    pub fn build<W: Write>(&mut self, mut writer: W) -> Result<PlasmidHeader> {
        // 1. Pack items into contiguous 16KB chunks
        let mut all_payload_bytes = Vec::new();
        let mut index_entries = Vec::new();

        for item in &self.items {
            let chunk_start = (all_payload_bytes.len() / DEFAULT_CHUNK_SIZE as usize) as u32;
            let byte_len = item.data.len();
            all_payload_bytes.extend_from_slice(&item.data);

            // Pad each entry to 16KB boundary to guarantee chunk independence if needed,
            // or allow packed streaming. Here we align to 16KB boundary for clean BEP 52 P2P slicing.
            let remainder = all_payload_bytes.len() % DEFAULT_CHUNK_SIZE as usize;
            let padding = if remainder == 0 {
                0
            } else {
                DEFAULT_CHUNK_SIZE as usize - remainder
            };
            all_payload_bytes.resize(all_payload_bytes.len() + padding, 0);

            let chunk_end = (all_payload_bytes.len() / DEFAULT_CHUNK_SIZE as usize) as u32;
            let chunk_count = chunk_end - chunk_start;

            index_entries.push(PlasmidIndexEntry {
                chrom_id: item.chrom_id,
                entry_type: item.entry_type,
                flags: item.flags,
                start_pos: item.start_pos,
                end_pos: item.end_pos,
                chunk_start,
                chunk_count,
                payload_bytes: byte_len as u32,
            });
        }

        let dir = PlasmidDirectory::new(index_entries);
        let serialized_index = dir.serialize();
        let metadata_bytes = self.metadata_json.as_bytes();

        // Calculate chunk slices for Merkle tree
        let total_chunks = (all_payload_bytes.len() / DEFAULT_CHUNK_SIZE as usize) as u64;
        let mut chunk_slices = Vec::with_capacity(total_chunks as usize);
        for i in 0..total_chunks as usize {
            let start = i * DEFAULT_CHUNK_SIZE as usize;
            let end = start + DEFAULT_CHUNK_SIZE as usize;
            chunk_slices.push(&all_payload_bytes[start..end]);
        }

        let merkle_tree = MerkleTree::from_chunks(&chunk_slices);
        let root_hash = merkle_tree.root();

        // Calculate byte offsets
        // Layout: [HEADER (128)] -> [INDEX] -> [METADATA] -> [PAYLOAD 16KB CHUNKS]
        let index_offset = HEADER_SIZE as u64;
        let index_length = serialized_index.len() as u64;

        let metadata_offset = index_offset + index_length;
        let metadata_length = metadata_bytes.len() as u64;

        let _payload_offset = metadata_offset + metadata_length;
        let header = PlasmidHeader {
            version: 1,
            flags: 0,
            reference_build: self.reference_build.clone(),
            root_hash,
            chunk_size: DEFAULT_CHUNK_SIZE,
            total_chunks,
            total_payload_bytes: all_payload_bytes.len() as u64,
            index_offset,
            index_length,
            metadata_offset,
            metadata_length,
        };

        // Write components
        header.write_to(&mut writer)?;
        writer.write_all(&serialized_index)?;
        writer.write_all(metadata_bytes)?;
        writer.write_all(&all_payload_bytes)?;

        Ok(header)
    }
}
