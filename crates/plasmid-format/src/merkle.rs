use sha2::{Digest, Sha256};

pub const HASH_SIZE: usize = 32;

/// Calculates SHA-256 hash of a single byte slice.
pub fn hash_leaf(data: &[u8]) -> [u8; HASH_SIZE] {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().into()
}

/// Combines two child hashes into a parent hash: SHA-256(left || right).
pub fn hash_node(left: &[u8; HASH_SIZE], right: &[u8; HASH_SIZE]) -> [u8; HASH_SIZE] {
    let mut hasher = Sha256::new();
    hasher.update(left);
    hasher.update(right);
    hasher.finalize().into()
}

/// Merkle Tree for BitTorrent v2 BEP 52 style block verification.
#[derive(Debug, Clone)]
pub struct MerkleTree {
    pub leaves: Vec<[u8; HASH_SIZE]>,
    pub layers: Vec<Vec<[u8; HASH_SIZE]>>,
}

impl MerkleTree {
    pub fn from_chunks(chunks: &[&[u8]]) -> Self {
        let leaves: Vec<[u8; HASH_SIZE]> = chunks.iter().map(|c| hash_leaf(c)).collect();
        Self::from_leaves(leaves)
    }

    pub fn from_leaves(leaves: Vec<[u8; HASH_SIZE]>) -> Self {
        if leaves.is_empty() {
            return Self {
                leaves: vec![],
                layers: vec![vec![[0u8; HASH_SIZE]]],
            };
        }

        let mut layers = Vec::new();
        layers.push(leaves.clone());

        let mut current = leaves.clone();
        while current.len() > 1 {
            let mut next = Vec::with_capacity(current.len().div_ceil(2));
            for chunk in current.chunks(2) {
                if chunk.len() == 2 {
                    next.push(hash_node(&chunk[0], &chunk[1]));
                } else {
                    // Odd element: duplicate to maintain balanced binary tree
                    next.push(hash_node(&chunk[0], &chunk[0]));
                }
            }
            layers.push(next.clone());
            current = next;
        }

        Self { leaves, layers }
    }

    pub fn root(&self) -> [u8; HASH_SIZE] {
        self.layers
            .last()
            .and_then(|layer| layer.first())
            .copied()
            .unwrap_or([0u8; HASH_SIZE])
    }

    /// Generates audit proof path for a given leaf index.
    pub fn proof(&self, leaf_index: usize) -> Option<Vec<([u8; HASH_SIZE], bool)>> {
        if leaf_index >= self.leaves.len() {
            return None;
        }

        let mut path = Vec::new();
        let mut idx = leaf_index;

        for layer in &self.layers[..self.layers.len() - 1] {
            let is_right = idx % 2 == 1;
            let sibling_idx = if is_right {
                idx - 1
            } else if idx + 1 < layer.len() {
                idx + 1
            } else {
                idx // self-duplicated
            };

            path.push((layer[sibling_idx], is_right));
            idx /= 2;
        }

        Some(path)
    }

    /// Verifies a chunk against a known root hash and proof path.
    pub fn verify_chunk(
        chunk: &[u8],
        root: &[u8; HASH_SIZE],
        proof: &[([u8; HASH_SIZE], bool)],
    ) -> bool {
        let mut current = hash_leaf(chunk);
        for &(sibling, is_right) in proof {
            current = if is_right {
                hash_node(&sibling, &current)
            } else {
                hash_node(&current, &sibling)
            };
        }
        &current == root
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merkle_tree_proof_verification() {
        let chunks: Vec<Vec<u8>> = (0..7).map(|i| vec![i as u8; 16384]).collect();
        let chunk_refs: Vec<&[u8]> = chunks.iter().map(|c| c.as_slice()).collect();

        let tree = MerkleTree::from_chunks(&chunk_refs);
        let root = tree.root();
        assert_ne!(root, [0u8; 32]);

        for i in 0..7 {
            let proof = tree.proof(i).expect("Proof should exist");
            let valid = MerkleTree::verify_chunk(&chunks[i], &root, &proof);
            assert!(valid, "Chunk {i} failed verification");

            // Tamper test
            let mut tampered = chunks[i].clone();
            tampered[0] ^= 0xff;
            let invalid = MerkleTree::verify_chunk(&tampered, &root, &proof);
            assert!(!invalid, "Tampered chunk {i} should fail");
        }
    }
}
