use crate::error::{PlasmidCoreError, Result};
use plasmid_format::{HASH_SIZE, MerkleTree, hash_leaf};

/// Zero-copy slice view over a raw memory buffer (e.g. from network or WASM heap).
#[derive(Debug, Clone)]
pub struct SliceBuffer<'a> {
    data: &'a [u8],
}

impl<'a> SliceBuffer<'a> {
    pub fn new(data: &'a [u8]) -> Self {
        Self { data }
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    pub fn as_slice(&self) -> &'a [u8] {
        self.data
    }

    /// Obtains a zero-copy subslice within the buffer.
    pub fn subslice(&self, start: usize, end: usize) -> Result<&'a [u8]> {
        if start > end || end > self.data.len() {
            return Err(PlasmidCoreError::InvalidCoordinateRange {
                start: start as u64,
                end: end as u64,
            });
        }
        Ok(&self.data[start..end])
    }

    /// Verifies that this slice buffer matches an expected SHA-256 chunk hash.
    pub fn verify_hash(&self, expected_hash: &[u8; HASH_SIZE]) -> bool {
        let computed = hash_leaf(self.data);
        &computed == expected_hash
    }

    /// Verifies this chunk buffer against a BitTorrent v2 root hash and proof path.
    pub fn verify_merkle(&self, root: &[u8; HASH_SIZE], proof: &[([u8; HASH_SIZE], bool)]) -> bool {
        MerkleTree::verify_chunk(self.data, root, proof)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zero_copy_subslice_and_hash() {
        let raw = b"PLASMID_ZERO_COPY_PAYLOAD_CHUNK_DATA_HERE";
        let buf = SliceBuffer::new(raw);

        let sub = buf.subslice(0, 7).unwrap();
        assert_eq!(sub, b"PLASMID");

        let hash = hash_leaf(raw);
        assert!(buf.verify_hash(&hash));

        let mut tampered = hash;
        tampered[0] ^= 0x01;
        assert!(!buf.verify_hash(&tampered));
    }
}
