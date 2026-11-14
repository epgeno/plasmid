#!/usr/bin/env python3
"""
Deterministic compiler for UCSC hg19ToHg38.over.chain.gz -> crates/plasmid-core/data/hg19_to_hg38_chain.bin.zst.

Extracts primary-assembly (chr1..chr22, chrX, chrY, chrM) ungapped syntenic alignment blocks
ordered by UCSC chain score priority, delta-encodes 1-based inclusive coordinates, and compresses
with Zstandard (RFC 8878) for zero-network embedded WebAssembly Liftover in `plasmid-core`.
"""

from __future__ import annotations

import argparse
import bisect
import gzip
import os
import struct
import subprocess
import urllib.request
from pathlib import Path

UCSC_CHAIN_URL = (
    "https://hgdownload.soe.ucsc.edu/goldenPath/hg19/liftOver/hg19ToHg38.over.chain.gz"
)

CHROM_MAP: dict[str, int] = {f"chr{i}": i for i in range(1, 23)} | {
    "chrX": 23,
    "chrY": 24,
    "chrM": 25,
}


def has_overlap(intervals: list[tuple[int, int]], start: int, end: int) -> bool:
    idx = bisect.bisect_right(intervals, (start, 1 << 60))
    if idx > 0 and intervals[idx - 1][1] >= start:
        return True
    if idx < len(intervals) and intervals[idx][0] <= end:
        return True
    return False


def insert_interval(intervals: list[tuple[int, int]], start: int, end: int) -> None:
    bisect.insort(intervals, (start, end))


def parse_ucsc_chain(chain_gz_path: Path) -> list[tuple[int, int, int, int, int]]:
    raw_chains: list[tuple[int, int, str, list[tuple[int, int, int]]]] = []

    with gzip.open(chain_gz_path, "rt", encoding="utf-8") as fh:
        cur_meta: list[int | str] | None = None
        blocks: list[tuple[int, int, int]] = []

        for raw_line in fh:
            line = raw_line.strip()
            if not line:
                if cur_meta is not None and blocks:
                    raw_chains.append(
                        (int(cur_meta[0]), int(cur_meta[1]), str(cur_meta[5]), blocks)
                    )
                cur_meta = None
                blocks = []
                continue

            if line.startswith("chain "):
                if cur_meta is not None and blocks:
                    raw_chains.append(
                        (int(cur_meta[0]), int(cur_meta[1]), str(cur_meta[5]), blocks)
                    )
                blocks = []
                parts = line.split()
                # chain score tName tSize tStrand tStart tEnd qName qSize qStrand qStart qEnd id
                score = int(parts[1])
                t_name, t_strand, t_start = parts[2], parts[4], int(parts[5])
                q_name, q_size, q_strand, q_start = (
                    parts[7],
                    int(parts[8]),
                    parts[9],
                    int(parts[10]),
                )
                if t_name in CHROM_MAP and t_name == q_name and t_strand == "+":
                    cur_meta = [
                        score,
                        CHROM_MAP[t_name],
                        t_start,
                        q_start,
                        q_size,
                        q_strand,
                    ]
                else:
                    cur_meta = None
            elif cur_meta is not None:
                parts = line.split()
                size = int(parts[0])
                t_pos = int(cur_meta[2])
                q_pos = int(cur_meta[3])
                q_size = int(cur_meta[4])
                q_strand = str(cur_meta[5])

                # Convert UCSC 0-based half-open coordinates to 1-based VCF coordinates
                src_1 = t_pos + 1
                dst_anchor_1 = (q_pos + 1) if q_strand == "+" else (q_size - q_pos)
                blocks.append((src_1, size, dst_anchor_1))

                if len(parts) == 3:
                    cur_meta[2] = t_pos + size + int(parts[1])
                    cur_meta[3] = q_pos + size + int(parts[2])

        if cur_meta is not None and blocks:
            raw_chains.append(
                (int(cur_meta[0]), int(cur_meta[1]), str(cur_meta[5]), blocks)
            )

    # Sort chains by alignment score descending (UCSC primary liftover priority)
    raw_chains.sort(key=lambda c: c[0], reverse=True)

    occupied_src: dict[int, list[tuple[int, int]]] = {cid: [] for cid in range(1, 26)}
    occupied_dst: dict[int, list[tuple[int, int]]] = {cid: [] for cid in range(1, 26)}
    kept_blocks: list[tuple[int, int, int, int, int]] = []

    for _score, cid, strand, blks in raw_chains:
        strand_code = 0 if strand == "+" else 1
        for src_1, size, dst_anchor_1 in blks:
            src_end = src_1 + size - 1
            if strand_code == 0:
                dst_min, dst_max = dst_anchor_1, dst_anchor_1 + size - 1
            else:
                dst_min, dst_max = dst_anchor_1 - size + 1, dst_anchor_1

            if has_overlap(occupied_src[cid], src_1, src_end):
                continue
            if has_overlap(occupied_dst[cid], dst_min, dst_max):
                continue

            insert_interval(occupied_src[cid], src_1, src_end)
            insert_interval(occupied_dst[cid], dst_min, dst_max)
            kept_blocks.append((cid, strand_code, src_1, size, dst_anchor_1))

    kept_blocks.sort(key=lambda b: (b[0], b[2]))
    return kept_blocks


def encode_delta_binary(blocks: list[tuple[int, int, int, int, int]]) -> bytes:
    buf = bytearray()
    buf.extend(b"PLCHAIN1")
    buf.extend(struct.pack("<I", len(blocks)))

    prev_cid = 0
    prev_src = 0
    prev_dst = 0

    for cid, strand_code, src_1, size, dst_anchor_1 in blocks:
        if cid != prev_cid:
            prev_cid = cid
            prev_src = 0
            prev_dst = 0

        d_src = src_1 - prev_src
        d_dst = dst_anchor_1 - prev_dst
        buf.extend(struct.pack("<BBiIi", cid, strand_code, d_src, size, d_dst))

        prev_src = src_1 + size
        prev_dst = (dst_anchor_1 + size) if strand_code == 0 else (dst_anchor_1 - size)

    return bytes(buf)


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    default_out = repo_root / "crates/plasmid-core/data/hg19_to_hg38_chain.bin.zst"
    scratch_dir = Path(os.environ.get("TMPDIR", "/tmp"))

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=scratch_dir / "hg19ToHg38.over.chain.gz",
        help="Path to UCSC hg19ToHg38.over.chain.gz (downloaded if missing)",
    )
    parser.add_argument("--output", type=Path, default=default_out)
    args = parser.parse_args()

    if not args.input.exists():
        args.input.parent.mkdir(parents=True, exist_ok=True)
        print(f"[liftover-chain] Downloading {UCSC_CHAIN_URL} -> {args.input} ...")
        urllib.request.urlretrieve(UCSC_CHAIN_URL, args.input)

    blocks = parse_ucsc_chain(args.input)
    raw_bin = encode_delta_binary(blocks)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    proc = subprocess.run(
        ["zstd", "-19", "--stdout"],
        input=raw_bin,
        stdout=subprocess.PIPE,
        check=True,
    )
    args.output.write_bytes(proc.stdout)
    print(
        f"[liftover-chain] Wrote {len(blocks)} non-overlapping syntenic blocks "
        f"({len(raw_bin):,} B raw -> {len(proc.stdout):,} B zstd) to {args.output}"
    )


if __name__ == "__main__":
    main()
