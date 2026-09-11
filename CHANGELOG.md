# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-alpha] - 2026-09-11

### Added
- **RFC-0001**: Single-container `.plasmid` format specification (PMTiles style with 16KB Merkle leaf chunks).
- **RFC-0002**: Air-gapped privacy architecture specification separating private genomes from public WebRTC swarms.
- **crates/plasmid-format**: Rust implementation of 128-byte header, SHA-256 Merkle tree (BEP 52), 32-byte index directory, and binary builder/reader.
- **crates/plasmid-core**: Range Slicing query coordinator and noodles-based VCF record streaming decoder.
- **crates/plasmid-swarm**: WebRTC P2P chunk protocol types, RTT peer ranking, and Byzantine chunk verification engine.
- **apps/web**: React 19 + Vite 6 ultra-lightweight client with Pure White (#FFFFFF) flat monochrome UI, ClinVar knowledge cards, and live swarm telemetry.
- **Brand Assets**: Official 2D vector plasmid mark (`assets/brand/plasmid-mark.svg`) and repository banner (`assets/brand/plasmid-banner.svg`).
