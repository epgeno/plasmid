# RFC-0001: The `.plasmid` Single-Container Genomic Archive Specification

- **Status:** Draft
- **Authors:** epgeno Architecture Working Group
- **Created:** 2026-09-10
- **Target Implementation:** `crates/plasmid-format`

---

## 1. Abstract

The `.plasmid` format is a single-file, multi-resolution genomic container designed for high-concurrency byte-range streaming (HTTP Range / S3 / R2) and BitTorrent v2 (BEP 52) P2P distribution. Similar to PMTiles for map cartography, `.plasmid` allows random access to multi-gigabyte genomic sequences and variant annotations directly in web browsers via WebAssembly with zero server-side computation.

---

## 2. Structural Blueprint

```text
+-------------------------------------------------------------+
| Header (128 bytes, fixed)                                   |
| - Magic: "PLASMID\x01"                                      |
| - Format Version: uint16                                    |
| - Reference Build: 16 bytes UTF-8 (e.g. "GRCh38\0...")      |
| - Root Merkle Hash: 32 bytes (SHA-256)                      |
| - Chunk Size: uint32 (default 16384 = 16 KB)                |
| - Directory Offset: uint64                                  |
| - Directory Length: uint64                                  |
+-------------------------------------------------------------+
| Merkle Tree Block Hashes (BEP 52 Tree Layers)               |
+-------------------------------------------------------------+
| Directory Index (Hilber/Morton sorted coordinate index)     |
| - Chromosome ID                                             |
| - Start Coordinate, End Coordinate                          |
| - Byte Offset, Byte Length                                  |
| - Decompression Codec (0: Raw, 1: BGZF, 2: Zstd)            |
+-------------------------------------------------------------+
| Payload Chunks (Data Slices)                                |
| - Chunk 0 (16 KB)                                           |
| - Chunk 1 (16 KB)                                           |
| ...                                                         |
+-------------------------------------------------------------+
```

---

## 3. BitTorrent v2 Compatibility (BEP 52)

- Every payload block is exactly aligned to `16,384` bytes (`16 KB`).
- Leaf SHA-256 hashes roll up into an immutable root hash.
- WebRTC peers can request individual 16 KB chunks without needing the whole chromosome.
