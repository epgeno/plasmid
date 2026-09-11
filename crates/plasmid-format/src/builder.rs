use crate::error::Result;
use crate::header::{DEFAULT_CHUNK_SIZE, FLAG_HIERARCHICAL_INDEX, HEADER_SIZE, PlasmidHeader};
use crate::index::{
    EntryType, PlasmidDirectory, PlasmidIndexEntry, PlasmidLeafPointer, PlasmidRootDirectory,
    INDEX_LEAF_POINTER_SIZE,
};
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

    /// Builds a hierarchical PMTiles v3 style .plasmid container with 2-stage Leaf Directories.
    /// Enables Range Request retrieval of 2KB leaf blocks for large indices.
    pub fn build_hierarchical<W: Write>(
        &mut self,
        mut writer: W,
        entries_per_leaf: usize,
    ) -> Result<PlasmidHeader> {
        let entries_per_leaf = entries_per_leaf.max(1);

        // 1. Pack items into contiguous 16KB chunks
        let mut all_payload_bytes = Vec::new();
        let mut index_entries = Vec::new();

        for item in &self.items {
            let chunk_start = (all_payload_bytes.len() / DEFAULT_CHUNK_SIZE as usize) as u32;
            let byte_len = item.data.len();
            all_payload_bytes.extend_from_slice(&item.data);

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

        // Sort all index entries by (chrom_id, start_pos, entry_type)
        index_entries.sort_by_key(|e| (e.chrom_id, e.start_pos, e.entry_type as u8));

        // 2. Partition entries into leaf directories
        let mut leaf_dirs: Vec<PlasmidDirectory> = Vec::new();
        let mut current_partition: Vec<PlasmidIndexEntry> = Vec::new();

        for entry in index_entries {
            // If chromosome changed or reached entries_per_leaf limit, flush partition
            if !current_partition.is_empty()
                && (current_partition.len() >= entries_per_leaf
                    || current_partition.last().unwrap().chrom_id != entry.chrom_id)
            {
                leaf_dirs.push(PlasmidDirectory::new(std::mem::take(&mut current_partition)));
            }
            current_partition.push(entry);
        }
        if !current_partition.is_empty() {
            leaf_dirs.push(PlasmidDirectory::new(current_partition));
        }

        // Serialize all leaf directories
        let mut serialized_leaves: Vec<Vec<u8>> = Vec::with_capacity(leaf_dirs.len());
        for leaf in &leaf_dirs {
            let bytes = leaf.serialize();
            serialized_leaves.push(bytes);
        }

        // 3. Layout calculation:
        // [HEADER (128)] -> [ROOT DIRECTORY] -> [LEAF DIRECTORIES] -> [METADATA] -> [PAYLOAD CHUNKS]
        let root_dir_offset = HEADER_SIZE as u64;
        let root_dir_len = (leaf_dirs.len() * INDEX_LEAF_POINTER_SIZE) as u64;
        let mut current_leaf_offset = root_dir_offset + root_dir_len;

        let mut leaf_pointers = Vec::with_capacity(leaf_dirs.len());
        for (i, leaf) in leaf_dirs.iter().enumerate() {
            let leaf_len = serialized_leaves[i].len() as u32;
            let min_pos = leaf.entries.first().map(|e| e.start_pos).unwrap_or(0);
            let max_pos = leaf.entries.last().map(|e| e.end_pos).unwrap_or(0);
            let chrom_id = leaf.entries.first().map(|e| e.chrom_id).unwrap_or(0);

            leaf_pointers.push(PlasmidLeafPointer {
                chrom_id,
                flags: 0,
                min_pos,
                max_pos,
                leaf_offset: current_leaf_offset,
                leaf_length: leaf_len,
                entry_count: leaf.entries.len() as u32,
            });
            current_leaf_offset += leaf_len as u64;
        }

        let root_dir = PlasmidRootDirectory::new(leaf_pointers);
        let serialized_root = root_dir.serialize();
        assert_eq!(serialized_root.len() as u64, root_dir_len);

        let metadata_bytes = self.metadata_json.as_bytes();
        let metadata_offset = current_leaf_offset;
        let metadata_length = metadata_bytes.len() as u64;

        // 4. Merkle Root calculation
        let total_chunks = (all_payload_bytes.len() / DEFAULT_CHUNK_SIZE as usize) as u64;
        let mut chunk_slices = Vec::with_capacity(total_chunks as usize);
        for i in 0..total_chunks as usize {
            let start = i * DEFAULT_CHUNK_SIZE as usize;
            let end = start + DEFAULT_CHUNK_SIZE as usize;
            chunk_slices.push(&all_payload_bytes[start..end]);
        }
        let merkle_tree = MerkleTree::from_chunks(&chunk_slices);
        let root_hash = merkle_tree.root();

        let header = PlasmidHeader {
            version: 1,
            flags: FLAG_HIERARCHICAL_INDEX,
            reference_build: self.reference_build.clone(),
            root_hash,
            chunk_size: DEFAULT_CHUNK_SIZE,
            total_chunks,
            total_payload_bytes: all_payload_bytes.len() as u64,
            index_offset: root_dir_offset,
            index_length: root_dir_len,
            metadata_offset,
            metadata_length,
        };

        // Write components
        header.write_to(&mut writer)?;
        writer.write_all(&serialized_root)?;
        for leaf_bytes in &serialized_leaves {
            writer.write_all(leaf_bytes)?;
        }
        writer.write_all(metadata_bytes)?;
        writer.write_all(&all_payload_bytes)?;

        Ok(header)
    }
}
