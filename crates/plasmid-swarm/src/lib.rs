pub mod pack;

pub use pack::{PackCategory, PackManifest, PackSwarm, SelectiveSwarmManager};

use plasmid_format::{HASH_SIZE, MerkleTree};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SwarmError {
    #[error("Merkle verification failed for chunk {0}")]
    MerkleVerificationFailed(u32),

    #[error("Chunk not available in swarm: {0}")]
    ChunkUnavailable(u32),

    #[error("Peer not found: {0}")]
    PeerNotFound(String),

    #[error("Handshake root mismatch: expected {expected}, got {received}")]
    RootMismatch { expected: String, received: String },

    #[error("Pack not found: {0}")]
    PackNotFound(String),

    #[error("Peer banned for Byzantine malicious behavior: {0}")]
    PeerBanned(String),

    #[error("Origin HTTP fetch failed: {0}")]
    OriginFetchFailed(String),
}

pub type Result<T> = std::result::Result<T, SwarmError>;

/// BEP 52 P2P Wire Protocol messages over WebRTC DataChannel
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SwarmMessage {
    Handshake {
        root_hash: [u8; HASH_SIZE],
        peer_id: String,
    },
    HaveBitfield {
        available_chunks: Vec<u32>,
    },
    RequestChunk {
        chunk_index: u32,
    },
    PieceChunk {
        chunk_index: u32,
        data: Vec<u8>,
        proof: Vec<([u8; HASH_SIZE], bool)>,
    },
    CancelChunk {
        chunk_index: u32,
    },
}

#[derive(Debug, Clone)]
pub struct SwarmPeer {
    pub peer_id: String,
    pub available_chunks: Vec<u32>,
    pub rtt_ms: u32,
}

pub struct SwarmEngine {
    pub root_hash: [u8; HASH_SIZE],
    pub peers: HashMap<String, SwarmPeer>,
    pub local_cache: HashMap<u32, Vec<u8>>,
}

impl SwarmEngine {
    pub fn new(root_hash: [u8; HASH_SIZE]) -> Self {
        Self {
            root_hash,
            peers: HashMap::new(),
            local_cache: HashMap::new(),
        }
    }

    pub fn register_peer(&mut self, peer_id: &str, rtt_ms: u32) {
        self.peers.insert(
            peer_id.to_string(),
            SwarmPeer {
                peer_id: peer_id.to_string(),
                available_chunks: Vec::new(),
                rtt_ms,
            },
        );
    }

    pub fn update_peer_bitfield(&mut self, peer_id: &str, chunks: Vec<u32>) -> Result<()> {
        if let Some(peer) = self.peers.get_mut(peer_id) {
            peer.available_chunks = chunks;
            Ok(())
        } else {
            Err(SwarmError::PeerNotFound(peer_id.to_string()))
        }
    }

    /// Selects the lowest-latency peer that advertises the requested chunk.
    pub fn select_best_peer_for_chunk(&self, chunk_index: u32) -> Option<&SwarmPeer> {
        self.peers
            .values()
            .filter(|p| p.available_chunks.contains(&chunk_index))
            .min_by_key(|p| p.rtt_ms)
    }

    /// Receives and cryptographically verifies a 16KB chunk against the Merkle tree root.
    pub fn ingest_piece(
        &mut self,
        chunk_index: u32,
        data: Vec<u8>,
        proof: &[([u8; HASH_SIZE], bool)],
    ) -> Result<()> {
        let valid = MerkleTree::verify_chunk(&data, &self.root_hash, proof);
        if !valid {
            return Err(SwarmError::MerkleVerificationFailed(chunk_index));
        }

        self.local_cache.insert(chunk_index, data);
        Ok(())
    }

    pub fn has_chunk(&self, chunk_index: u32) -> bool {
        self.local_cache.contains_key(&chunk_index)
    }

    pub fn get_chunk(&self, chunk_index: u32) -> Option<&[u8]> {
        self.local_cache.get(&chunk_index).map(|v| v.as_slice())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use plasmid_format::DEFAULT_CHUNK_SIZE;

    #[test]
    fn test_swarm_chunk_exchange_and_tamper_defense() {
        // Generate test data for 4 chunks
        let chunks: Vec<Vec<u8>> = (0..4)
            .map(|i| vec![i as u8; DEFAULT_CHUNK_SIZE as usize])
            .collect();
        let chunk_slices: Vec<&[u8]> = chunks.iter().map(|c| c.as_slice()).collect();
        let tree = MerkleTree::from_chunks(&chunk_slices);
        let root = tree.root();

        let mut engine = SwarmEngine::new(root);

        // Register 2 peers
        engine.register_peer("peer-fast-tokyo", 15);
        engine.register_peer("peer-slow-us", 180);

        engine
            .update_peer_bitfield("peer-fast-tokyo", vec![0, 1])
            .unwrap();
        engine
            .update_peer_bitfield("peer-slow-us", vec![0, 1, 2, 3])
            .unwrap();

        // 1. Peer selection: for chunk 0, both have it, but fast-tokyo has lower RTT (15ms vs 180ms)
        let best_peer = engine.select_best_peer_for_chunk(0).unwrap();
        assert_eq!(best_peer.peer_id, "peer-fast-tokyo");

        // For chunk 2, only slow-us has it
        let best_peer_c2 = engine.select_best_peer_for_chunk(2).unwrap();
        assert_eq!(best_peer_c2.peer_id, "peer-slow-us");

        // 2. Ingest piece with valid Merkle proof
        let proof_0 = tree.proof(0).unwrap();
        engine
            .ingest_piece(0, chunks[0].clone(), &proof_0)
            .expect("Valid piece must be accepted");
        assert!(engine.has_chunk(0));
        assert_eq!(engine.get_chunk(0).unwrap(), chunks[0].as_slice());

        // 3. Tamper defense: malicious peer alters one byte
        let mut corrupted_data = chunks[1].clone();
        corrupted_data[42] ^= 0xff;
        let proof_1 = tree.proof(1).unwrap();

        let err = engine.ingest_piece(1, corrupted_data, &proof_1);
        assert!(
            matches!(err, Err(SwarmError::MerkleVerificationFailed(1))),
            "Corrupted piece must fail Merkle check"
        );
        assert!(!engine.has_chunk(1));
    }

    #[test]
    fn test_selective_hotspot_pack_routing() {
        let mut manager = SelectiveSwarmManager::new();

        let clinvar_manifest = PackManifest::new(
            "pack-clinvar-2026",
            "ClinVar Pathogenic Variants",
            PackCategory::ClinVarPathogenic,
            [0x11; HASH_SIZE],
            100,
            vec!["BRCA1".to_string(), "BRCA2".to_string(), "TP53".to_string()],
            "https://origin.plasmid.wiki/packs/clinvar.plasmid",
        );

        let pharmacogenomics_manifest = PackManifest::new(
            "pack-pharm-2026",
            "CPIC Pharmacogenomics",
            PackCategory::Pharmacogenomics,
            [0x22; HASH_SIZE],
            25,
            vec!["CYP2D6".to_string(), "CYP2C19".to_string()],
            "https://origin.plasmid.wiki/packs/pharm.plasmid",
        );

        manager.register_pack(clinvar_manifest);
        manager.register_pack(pharmacogenomics_manifest);

        // Query BRCA1: routes only to ClinVar pack
        let brca1_packs = manager.find_packs_for_gene("BRCA1");
        assert_eq!(brca1_packs.len(), 1);
        assert_eq!(brca1_packs[0].pack_id, "pack-clinvar-2026");

        // Query CYP2D6: routes only to CPIC pack
        let cyp_packs = manager.find_packs_for_gene("CYP2D6");
        assert_eq!(cyp_packs.len(), 1);
        assert_eq!(cyp_packs[0].pack_id, "pack-pharm-2026");

        // Query non-hotspot gene: returns empty without swarming full 100Gb
        let junk_gene_packs = manager.find_packs_for_gene("OR4F5");
        assert!(junk_gene_packs.is_empty());
    }

    #[test]
    fn test_adversarial_byzantine_peer_banning_and_origin_fallback() {
        // Prepare valid data for pack
        let chunk_data = vec![0x42u8; DEFAULT_CHUNK_SIZE as usize];
        let slices = [&chunk_data[..]];
        let tree = MerkleTree::from_chunks(&slices);
        let valid_proof = tree.proof(0).unwrap();

        let manifest = PackManifest::new(
            "pack-acmg-81",
            "ACMG Secondary Findings v3.2",
            PackCategory::AcmgSecondaryFindings,
            tree.root(),
            1,
            vec!["BRCA1".to_string()],
            "https://origin.plasmid.wiki/packs/acmg.plasmid",
        );

        let mut manager = SelectiveSwarmManager::new();
        manager.register_pack(manifest);

        // Register malicious peer
        manager
            .subscribe_peer_to_pack("pack-acmg-81", "malicious-peer-x", 10)
            .unwrap();

        // 1. Adversarial Attack: Malicious peer sends corrupted chunk payload
        let mut corrupted_chunk = chunk_data.clone();
        corrupted_chunk[0] ^= 0xbb; // Bit-flip

        let ingest_res = manager.ingest_peer_chunk(
            "pack-acmg-81",
            "malicious-peer-x",
            0,
            corrupted_chunk,
            &valid_proof,
        );

        assert!(
            matches!(ingest_res, Err(SwarmError::MerkleVerificationFailed(0))),
            "Corrupted chunk must fail Merkle check"
        );

        // Verify malicious peer was immediately banned
        assert!(manager.banned_peers.contains("malicious-peer-x"));

        // Malicious peer attempts to reconnect or send more data -> rejected with PeerBanned
        let reconnect_res = manager.subscribe_peer_to_pack("pack-acmg-81", "malicious-peer-x", 10);
        assert!(
            matches!(reconnect_res, Err(SwarmError::PeerBanned(_))),
            "Banned peer must be rejected on connection attempt"
        );

        // 2. Transparent Fallback to Cloudflare R2 / S3 Origin with Merkle verification
        let resolved_data =
            manager.resolve_chunk_with_fallback("pack-acmg-81", 0, |origin_url, chunk_idx| {
                assert_eq!(origin_url, "https://origin.plasmid.wiki/packs/acmg.plasmid");
                assert_eq!(chunk_idx, 0);
                // Simulated origin return with valid data & proof
                Ok((chunk_data.clone(), valid_proof.clone()))
            });

        assert!(resolved_data.is_ok(), "Origin fallback must succeed");
        let resolved = resolved_data.unwrap();
        assert_eq!(resolved, chunk_data);

        // Verify chunk is now in local cache
        let pack_swarm = manager.packs.get("pack-acmg-81").unwrap();
        assert!(pack_swarm.engine.has_chunk(0));
        println!(
            "[Adversarial Defense Verified] Banned malicious peer and successfully recovered via Origin fallback"
        );
    }
}
