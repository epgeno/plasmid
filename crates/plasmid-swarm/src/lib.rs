//! # plasmid-swarm
//!
//! P2P block exchange engine implementing BitTorrent v2 chunking and WebRTC datachannel transport.

pub use plasmid_format::*;

#[derive(Debug, Clone)]
pub struct SwarmPeer {
    pub peer_id: [u8; 20],
    pub is_seeder: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum SwarmError {
    #[error("Swarm connection failed: {0}")]
    ConnectionFailed(String),
    #[error("Chunk verification failed for hash: {0}")]
    HashMismatch(String),
}
