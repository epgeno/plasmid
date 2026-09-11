use crate::{SwarmEngine, SwarmError};
use plasmid_format::{DEFAULT_CHUNK_SIZE, HASH_SIZE, MerkleTree};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PackCategory {
    ClinVarPathogenic,     // Curated pathogenic & likely pathogenic variants (~50MB)
    AcmgSecondaryFindings, // ACMG SF v3.2 actionable genes (81 genes, ~15MB)
    Pharmacogenomics,      // CPIC actionable drug-gene interactions (~5MB)
    CarrierScreening,      // Severe recessive inheritance loci (~20MB)
    GenePanel(String),     // User-custom or disease-specific panel
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackManifest {
    pub pack_id: String,
    pub name: String,
    pub category: PackCategory,
    pub root_hash: [u8; HASH_SIZE],
    pub chunk_count: u32,
    pub total_bytes: u64,
    pub target_genes: Vec<String>,
    pub origin_url: String,
}

impl PackManifest {
    pub fn new(
        pack_id: &str,
        name: &str,
        category: PackCategory,
        root_hash: [u8; HASH_SIZE],
        chunk_count: u32,
        target_genes: Vec<String>,
        origin_url: &str,
    ) -> Self {
        Self {
            pack_id: pack_id.to_string(),
            name: name.to_string(),
            category,
            root_hash,
            chunk_count,
            total_bytes: chunk_count as u64 * DEFAULT_CHUNK_SIZE as u64,
            target_genes,
            origin_url: origin_url.to_string(),
        }
    }
}

pub struct PackSwarm {
    pub manifest: PackManifest,
    pub engine: SwarmEngine,
}

/// Manages multiple selective annotation packs and routes genomic queries
/// to the appropriate P2P topic or fails over to cloud origin storage.
pub struct SelectiveSwarmManager {
    pub packs: HashMap<String, PackSwarm>,
    pub banned_peers: HashSet<String>,
    pub peer_strikes: HashMap<String, u32>,
    pub gene_to_packs: HashMap<String, Vec<String>>,
}

impl Default for SelectiveSwarmManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SelectiveSwarmManager {
    pub fn new() -> Self {
        Self {
            packs: HashMap::new(),
            banned_peers: HashSet::new(),
            peer_strikes: HashMap::new(),
            gene_to_packs: HashMap::new(),
        }
    }

    /// Registers a new hotspot annotation pack.
    pub fn register_pack(&mut self, manifest: PackManifest) {
        let pack_id = manifest.pack_id.clone();
        let engine = SwarmEngine::new(manifest.root_hash);

        for gene in &manifest.target_genes {
            self.gene_to_packs
                .entry(gene.to_uppercase())
                .or_default()
                .push(pack_id.clone());
        }

        self.packs.insert(pack_id, PackSwarm { manifest, engine });
    }

    /// Returns all pack manifests covering a specific target gene.
    pub fn find_packs_for_gene(&self, gene: &str) -> Vec<&PackManifest> {
        let gene_upper = gene.to_uppercase();
        if let Some(pack_ids) = self.gene_to_packs.get(&gene_upper) {
            pack_ids
                .iter()
                .filter_map(|id| self.packs.get(id).map(|p| &p.manifest))
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Subscribes a peer to a specific pack swarm topic.
    pub fn subscribe_peer_to_pack(
        &mut self,
        pack_id: &str,
        peer_id: &str,
        rtt_ms: u32,
    ) -> Result<(), SwarmError> {
        if self.banned_peers.contains(peer_id) {
            return Err(SwarmError::PeerBanned(peer_id.to_string()));
        }

        let swarm = self
            .packs
            .get_mut(pack_id)
            .ok_or_else(|| SwarmError::PackNotFound(pack_id.to_string()))?;
        swarm.engine.register_peer(peer_id, rtt_ms);
        Ok(())
    }

    /// Updates peer chunk availability for a pack.
    pub fn update_peer_bitfield(
        &mut self,
        pack_id: &str,
        peer_id: &str,
        chunks: Vec<u32>,
    ) -> Result<(), SwarmError> {
        if self.banned_peers.contains(peer_id) {
            return Err(SwarmError::PeerBanned(peer_id.to_string()));
        }

        let swarm = self
            .packs
            .get_mut(pack_id)
            .ok_or_else(|| SwarmError::PackNotFound(pack_id.to_string()))?;
        swarm.engine.update_peer_bitfield(peer_id, chunks)
    }

    /// Ingests a chunk from a peer. If the chunk fails Merkle verification,
    /// the peer is struck and banned, and an error is returned.
    pub fn ingest_peer_chunk(
        &mut self,
        pack_id: &str,
        peer_id: &str,
        chunk_index: u32,
        data: Vec<u8>,
        proof: &[([u8; HASH_SIZE], bool)],
    ) -> Result<(), SwarmError> {
        if self.banned_peers.contains(peer_id) {
            return Err(SwarmError::PeerBanned(peer_id.to_string()));
        }

        let swarm = self
            .packs
            .get_mut(pack_id)
            .ok_or_else(|| SwarmError::PackNotFound(pack_id.to_string()))?;

        match swarm.engine.ingest_piece(chunk_index, data, proof) {
            Ok(()) => Ok(()),
            Err(SwarmError::MerkleVerificationFailed(idx)) => {
                // Byzantine defense: penalize and ban peer immediately
                let strikes = self.peer_strikes.entry(peer_id.to_string()).or_insert(0);
                *strikes += 1;
                self.banned_peers.insert(peer_id.to_string());
                // Remove peer from swarm
                swarm.engine.peers.remove(peer_id);
                Err(SwarmError::MerkleVerificationFailed(idx))
            }
            Err(other) => Err(other),
        }
    }

    /// Resolves a chunk using a 3-tier strategy:
    /// 1. Local Cache (instant)
    /// 2. P2P Swarm Peer (if available)
    /// 3. Transparent Cloudflare R2 / S3 Origin Fallback with Merkle verification
    pub fn resolve_chunk_with_fallback<F>(
        &mut self,
        pack_id: &str,
        chunk_index: u32,
        fetch_origin_fn: F,
    ) -> Result<Vec<u8>, SwarmError>
    where
        F: FnOnce(&str, u32) -> Result<(Vec<u8>, Vec<([u8; HASH_SIZE], bool)>), String>,
    {
        let swarm = self
            .packs
            .get_mut(pack_id)
            .ok_or_else(|| SwarmError::PackNotFound(pack_id.to_string()))?;

        // 1. Check local cache
        if let Some(cached) = swarm.engine.get_chunk(chunk_index) {
            return Ok(cached.to_vec());
        }

        // 2. Check if a peer has the chunk
        let peer_candidate = swarm.engine.select_best_peer_for_chunk(chunk_index).cloned();

        if let Some(_peer) = peer_candidate {
            // In a live system, this sends WebRTC RequestChunk.
            // If the peer is responsive and honest, it gets ingested via `ingest_peer_chunk`.
        }

        // 3. Fallback to Origin HTTP Range Request if not in local cache
        let (origin_data, proof) = fetch_origin_fn(&swarm.manifest.origin_url, chunk_index)
            .map_err(SwarmError::OriginFetchFailed)?;

        // Verify Merkle integrity of origin payload
        let valid = MerkleTree::verify_chunk(&origin_data, &swarm.manifest.root_hash, &proof);
        if !valid {
            return Err(SwarmError::MerkleVerificationFailed(chunk_index));
        }

        // Cache locally to seed back into P2P network
        swarm.engine.local_cache.insert(chunk_index, origin_data.clone());
        Ok(origin_data)
    }
}
