# RFC-0002: Security, Privacy Isolation, and Byzantine Defense Architecture

- **Status:** Approved
- **Authors:** epgeno Architecture Working Group
- **Created:** 2026-09-11
- **Target Implementation:** `plasmid-core`, `plasmid-swarm`, `apps/web`

---

## 1. Overview & Threat Model

The Plasmid platform combines public genomic knowledge sharing via P2P swarms with private individual genome exploration. This RFC outlines the formal defense barriers against:

1. **Private Genomic Data Leakage:** Accidental or malicious seeding of user WGS/VCF files over the BitTorrent v2 swarm.
2. **Byzantine Data Poisoning:** Malicious peers broadcasting altered variant calls or altered ClinVar pathogenicity classifications.
3. **Reference Dependency Failure:** Missing reference sequences causing CRAM decoder crashes in isolated client workers.

---

## 2. Air-Gap Sandbox Specification

### 2.1 Domain Separation: Public Mesh vs. Private Vault
To prevent accidental leakage under GDPR and HIPAA guidelines:

- **Public Mesh Pipeline (`plasmid-swarm`):**
  - Only artifacts derived from public datasets (GRCh38 reference, ClinVar, gnomAD, dbSNP, Ensembl annotations) bearing pre-signed cryptographic root hashes from `epgeno` or trusted community multisig curators may initiate P2P WebRTC data channels.
  - P2P bitfield announcements only track whitelisted public container hashes.

- **Private Vault Pipeline (`plasmid-vault`):**
  - Personal sequencing data imported by the user (23andMe raw data, BAM, CRAM, VCF) is loaded strictly into an un-networked Web Worker.
  - The worker uses the browser's Origin Private File System (OPFS) for local caching.
  - The Private Vault code path has no references or imports to WebRTC `RTCPeerConnection` or WebSocket signaling.

---

## 3. Reference Sequence Interleaving (CRAM Failure Prevention)

CRAM compression records read differences relative to a reference genome. When streaming isolated 16KB slices, client decoders will fail if the matching reference segment is missing.

### 3.1 Paired Chunk Indexing
Inside every `.plasmid` container, for any interval indexed under `EntryType::CramAlignment` or `EntryType::VcfVariant`:
1. The container builder embeds the corresponding 2-bit compressed reference bases in an adjacent `EntryType::ReferenceFasta` index entry.
2. `GenomicCoordinator::plan_slice` computes the union of both data entries, guaranteeing that a single atomic fetch retrieves both the reference segment and alignment data.

---

## 4. Byzantine & Tamper Defense

1. **Deterministic Merkle Root:**
   The root hash of all 16KB leaf chunks is computed via SHA-256 binary tree (BEP 52 standard) and embedded in the immutable 128-byte header.
2. **Proof Verification Gate:**
   Prior to dispatching any chunk to `noodles-vcf` or WebGL render tracks, `SwarmEngine::ingest_piece` validates the audit proof against `root_hash`. Corrupted or poisoned pieces are immediately dropped, and offending peers are blacklisted.
