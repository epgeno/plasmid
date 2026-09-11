<div align="center">

<img src="assets/brand/plasmid-banner.png" alt="Plasmid Banner" width="100%" />

# 🧬 Plasmid

**Decentralized Genomic Wiki & Merkle Range Slicing Engine**

**[ English ](README.md)** • **[ 한국어 ](README.ko.md)**

<p align="center">
  <a href="https://github.com/epgeno/plasmid/actions/workflows/ci.yml"><img src="https://github.com/epgeno/plasmid/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <a href="https://github.com/epgeno/plasmid/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT%20%7C%20Apache--2.0-blue.svg?style=flat-square" alt="License" /></a>
  <a href="https://plasmid.wiki"><img src="https://img.shields.io/badge/Live-plasmid.wiki-2563eb.svg?style=flat-square" alt="Live Site" /></a>
  <a href="docs/rfc/0001-container-spec.md"><img src="https://img.shields.io/badge/Spec-RFC--0001%20%28.plasmid%29-success.svg?style=flat-square" alt="RFC-0001" /></a>
  <a href="docs/rfc/0002-privacy-and-airgap-isolation.md"><img src="https://img.shields.io/badge/Privacy-Air--Gapped%20Vault-slate.svg?style=flat-square" alt="RFC-0002" /></a>
</p>

</div>

---

## 🏛️ What is Plasmid?

**Plasmid** (`plasmid.wiki`) is an open-source, decentralized genomic knowledge mesh and streaming engine engineered to solve the three core crises facing modern human genomics:

1. **The Privacy & Corporate Bankruptcy Crisis**: In the wake of consumer DTC platform bankruptcies and genomic database auctions, users need a **zero-network, air-gapped local interpreter** where private WGS/VCF files never touch cloud servers.
2. **The Knowledge Decay Crisis**: Following the commercial acquisition and subsequent freeze of SNPedia, the scientific community lacks an immutable, censorship-resistant, community-driven variant interpretation wiki.
3. **The Egress Cost Wall**: Academic labs struggle with astronomical AWS S3 egress costs when hosting massive BAM/CRAM genome browsers. Plasmid's **PMTiles-inspired single-container format (`.plasmid`)** combined with **BitTorrent v2 (BEP 52) WebRTC swarming** reduces origin bandwidth costs by over 90%.

---

## ⚡ Key Architectural Pillars

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Plasmid Hybrid Mesh System                      │
├──────────────────────────────────┬─────────────────────────────────────┤
│     Public Swarm Layer (P2P)     │     Air-Gapped Local Vault (OPFS)   │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • ClinVar/ACMG Immutable SSOT    │ • User Raw WGS / BAM / CRAM / VCF   │
│ • 16KB Merkle Leaf Chunks        │ • In-Browser WASM Sequence Aligner  │
│ • BitTorrent v2 BEP 52 Swarms    │ • Zero Network Egress Guarantee     │
│ • Cloudflare R2 Fast Viewport    │ • Local-First Variant Interpretation│
└──────────────────────────────────┴─────────────────────────────────────┘
```

* **16KB Merkle Range Slicing**: Fetches genomic sub-regions on demand via HTTP Range Requests and WebRTC P2P chunk exchange, eliminating full file downloads.
* **Byzantine-Resilient WebRTC Swarm**: Verifies every 16KB leaf chunk against SHA-256 Merkle root proofs before handing bytes to the WASM decoder.
* **Physical Air-Gap Isolation (`plasmid-vault`)**: User genetic data is pinned to browser-isolated local storage (OPFS / IndexedDB). Outbound network traffic is mathematically restricted to fetching public variant annotation blocks.
* **Immutable Clinical Baseline**: Pathogenicity classifications from NCBI ClinVar and ACMG guidelines are cryptographically pinned as read-only SSOT tiers, shielding against wiki vandalism.

---

## 📁 Workspace Crates & Modules

| Path | Crates / App | Description |
| :--- | :--- | :--- |
| `crates/plasmid-format` | `plasmid-format` | 128-byte header, SHA-256 Merkle tree (BEP 52), and 32-byte index directory parser. |
| `crates/plasmid-core` | `plasmid-core` | Genomic coordinate query planner, Range Slicing coordinator, and `noodles` VCF decoder. |
| `crates/plasmid-swarm` | `plasmid-swarm` | WebRTC P2P chunk protocol, RTT-based peer selection, and Byzantine defense engine. |
| `apps/web` | `plasmid-web` | React 19 + Vite 6 ultra-lightweight client for `plasmid.wiki` (Pure White monochrome UI). |
| `docs/rfc` | RFC Specifications | Formal binary container and air-gap privacy specifications. |

---

## 🚀 Quick Start

### 1. Build and Test Rust Workspace

```bash
# Clone repository
git clone https://github.com/epgeno/plasmid.git
cd plasmid

# Run workspace tests
cargo test --workspace

# Check formatting and clippy
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
```

### 2. Run React 19 Web Client Locally

```bash
cd apps/web
pnpm install
pnpm dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📜 RFC Specifications

* [**RFC-0001: .plasmid Single-Container Archive Format**](docs/rfc/0001-container-spec.md): Specification for the PMTiles-like single container packaging genomic indices, 16KB Merkle chunks, and interleaved reference blocks.
* [**RFC-0002: Privacy, Air-Gap Isolation & Byzantine Defense**](docs/rfc/0002-privacy-and-airgap-isolation.md): Threat modeling, local-first sandbox architecture, and coordinate drift mitigation.

---

## 🔬 Citation

If you use Plasmid in your academic research or clinical genomics pipelines, please cite:

```bibtex
@software{plasmid2026,
  author = {epgeno contributors},
  title = {Plasmid: Decentralized Genomic Wiki & Merkle Range Slicing Engine},
  url = {https://github.com/epgeno/plasmid},
  version = {0.1.0-alpha},
  year = {2026}
}
```

---

## ⚖️ License

Dual-licensed under either of:
* Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
* MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.
