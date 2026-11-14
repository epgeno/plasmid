/**
 * Web Worker: Rust/WASM .plasmid Binary Container Decoder & Merkle Verifier
 *
 * Executes `plasmid-core` compiled to WebAssembly off the main UI thread:
 * - 128-byte .plasmid binary header deserialization
 * - Flat & 2-stage PMTiles-style hierarchical Root/Leaf directory indexing
 * - 16KB Merkle leaf chunk VCF / FASTA / ClinVar annotation decoding
 * - Cryptographic SHA-256 chunk and BEP 52 Merkle root verification
 * - GRCh37 <-> GRCh38 Liftover & single-base CoordinateGuard validation
 */

import initWasm, {
  initSync,
  PlasmidWasmEngine,
  type InitInput,
  type SyncInitInput,
} from '../wasm/plasmid_core.js';
import type {
  AnnotationRecord,
  DensityBin,
  LiftoverResult,
  ParsedVariant,
  PlasmidIndexEntry,
  PyramidIndex,
  SlicingPlan,
  VcfVariantRecord,
  WasmDecodedSlice,
  WasmHeaderInfo,
  WasmIndexEntryInfo,
  WasmLeafPointerInfo,
  WasmLeafQueryPlan,
  WasmMerkleVerification,
} from '../types/plasmid';

export type { ParsedVariant, DensityBin };

let wasmReadyPromise: Promise<void> | null = null;
let wasmInitialized = false;

export function initWorkerWasmSync(module: SyncInitInput): void {
  if (wasmInitialized) return;
  initSync({ module });
  wasmInitialized = true;
}

export async function ensureWorkerWasm(moduleOrPath?: InitInput): Promise<void> {
  if (wasmInitialized) return;
  if (!wasmReadyPromise) {
    wasmReadyPromise = (async () => {
      if (moduleOrPath !== undefined) {
        await initWasm({ module_or_path: moduleOrPath });
      } else {
        await initWasm();
      }
      wasmInitialized = true;
    })().catch((err) => {
      wasmReadyPromise = null;
      throw err;
    });
  }
  await wasmReadyPromise;
}

function toUint8Array(input: ArrayBuffer | Uint8Array): Uint8Array {
  if (input instanceof Uint8Array) {
    return input;
  }
  return new Uint8Array(input);
}

export function computeClinvarScore(clinvar?: string | null): number {
  if (!clinvar) return 1.0;
  const lower = clinvar.toLowerCase();
  if (lower.includes('pathogenic') && !lower.includes('conflict') && !lower.includes('benign')) {
    return 10.0;
  }
  if (lower.includes('risk')) {
    return 5.0;
  }
  if (lower.includes('uncertain') || lower.includes('vus')) {
    return 2.0;
  }
  if (lower.includes('benign')) {
    return 0.5;
  }
  return 1.0;
}

export function mapVcfRecordToParsedVariant(record: VcfVariantRecord): ParsedVariant {
  const clinvar = record.clinvar_significance ?? undefined;
  return {
    chrom: record.chrom,
    pos: record.pos,
    id: record.id ?? '.',
    ref: record.reference,
    alt: record.alternate,
    qual: record.qual,
    filter: record.filter,
    gene: record.gene ?? undefined,
    clinvar,
    aminoAcidChange: record.amino_acid_change ?? undefined,
    info: record.info ?? {},
    score: computeClinvarScore(clinvar),
  };
}

function normalizeChrom(chrom: string): string {
  return chrom.trim().replace(/^chr/i, '').toUpperCase();
}

export async function handleWorkerRequest(
  type: string,
  payload: Record<string, any>
): Promise<Record<string, any>> {
  if (type !== 'COMPUTE_DENSITY_BINS') {
    await ensureWorkerWasm();
  }

  switch (type) {
    case 'PARSE_HEADER': {
      const bytes = toUint8Array(payload.buffer);
      const header = PlasmidWasmEngine.parse_header(bytes) as WasmHeaderInfo;
      return { header };
    }

    case 'PARSE_ROOT_DIRECTORY': {
      const bytes = toUint8Array(payload.buffer);
      const leaves = PlasmidWasmEngine.parse_root_directory(bytes) as WasmLeafPointerInfo[];
      return { leaves };
    }

    case 'QUERY_ROOT_LEAVES': {
      const bytes = toUint8Array(payload.buffer);
      const plan = PlasmidWasmEngine.query_root_leaves(
        bytes,
        payload.chrom,
        payload.startPos,
        payload.endPos
      ) as WasmLeafQueryPlan;
      return { plan };
    }

    case 'PARSE_DIRECTORY_ENTRIES': {
      const bytes = toUint8Array(payload.buffer);
      const entries = PlasmidWasmEngine.parse_directory_entries(bytes) as WasmIndexEntryInfo[];
      return { entries };
    }

    case 'PLAN_RANGE_SLICE': {
      const bytes = toUint8Array(payload.buffer);
      const plan = PlasmidWasmEngine.plan_range_slice(
        bytes,
        payload.chrom,
        payload.startPos,
        payload.endPos,
        payload.payloadOffset,
        payload.chunkSize
      ) as SlicingPlan;
      return { plan };
    }

    case 'DECODE_PLASMID_SLICE': {
      const entries: PlasmidIndexEntry[] = payload.entries;
      const chunksBytes = toUint8Array(payload.chunksBuffer);
      const chunkIndices = new Uint32Array(payload.chunkIndices);
      const decoded = PlasmidWasmEngine.decode_planned_slice(
        JSON.stringify(entries),
        chunksBytes,
        chunkIndices,
        payload.chunkSize,
        payload.chrom,
        payload.startPos,
        payload.endPos
      ) as WasmDecodedSlice;

      const variants = decoded.slice.variants.map(mapVcfRecordToParsedVariant);
      return {
        slice: decoded.slice,
        variants,
        referenceSequence: decoded.slice.reference_sequence,
        annotations: decoded.slice.annotations,
        chunkHashes: decoded.chunk_hashes,
      };
    }

    case 'PARSE_VCF_CHUNK': {
      const bytes = toUint8Array(payload.buffer);
      const rawRecords = PlasmidWasmEngine.decode_vcf_chunk(bytes) as VcfVariantRecord[];
      const targetNorm = payload.targetChrom ? normalizeChrom(payload.targetChrom) : null;
      const windowStart: number | undefined = payload.windowStart;
      const windowEnd: number | undefined = payload.windowEnd;

      const variants = rawRecords
        .filter((rec) => {
          if (targetNorm && normalizeChrom(rec.chrom) !== targetNorm) {
            return false;
          }
          if (windowStart !== undefined && windowEnd !== undefined) {
            const varEnd = rec.pos + Math.max(1, rec.reference.length) - 1;
            if (rec.pos > windowEnd || varEnd < windowStart) {
              return false;
            }
          }
          return true;
        })
        .map(mapVcfRecordToParsedVariant);

      return { variants };
    }

    case 'DECODE_FASTA_SLICE': {
      const bytes = toUint8Array(payload.buffer);
      const startPos: number = payload.startPos ?? 1;
      const endPos: number = payload.endPos ?? 1;
      const sequence = PlasmidWasmEngine.decode_fasta_chunk(bytes, startPos, endPos);
      return { sequence };
    }

    case 'DECODE_ANNOTATION_CHUNK': {
      const bytes = toUint8Array(payload.buffer);
      const annotation = PlasmidWasmEngine.decode_annotation_chunk(bytes) as AnnotationRecord;
      return { annotation };
    }

    case 'VERIFY_CHUNK_HASH': {
      const chunkBytes = toUint8Array(payload.chunkBuffer);
      const sha256Hex = PlasmidWasmEngine.hash_chunk_hex(chunkBytes);
      let verified = true;
      if (payload.expectedHash) {
        const expected = toUint8Array(payload.expectedHash);
        verified = PlasmidWasmEngine.verify_chunk_hash(chunkBytes, expected);
      } else if (typeof payload.expectedHex === 'string') {
        verified =
          sha256Hex.toLowerCase() ===
          payload.expectedHex.trim().replace(/^0x/i, '').toLowerCase();
      }
      return { verified, sha256Hex };
    }

    case 'VERIFY_MERKLE_TREE': {
      const payloadBytes = toUint8Array(payload.payloadBuffer);
      const verification = PlasmidWasmEngine.verify_merkle_tree(
        payloadBytes,
        payload.chunkSize,
        payload.expectedRootHex
      ) as WasmMerkleVerification;
      return { verification };
    }

    case 'GET_ASSEMBLY_OVERVIEW': {
      const pyramid = PlasmidWasmEngine.get_assembly_overview(payload.assembly) as PyramidIndex;
      return { pyramid };
    }

    case 'LIFTOVER_COORDINATE': {
      const result = (
        payload.direction === 'hg19_to_hg38'
          ? PlasmidWasmEngine.liftover_hg19_to_hg38(
              payload.chrom,
              payload.pos,
              payload.refAllele
            )
          : PlasmidWasmEngine.liftover_hg38_to_hg19(
              payload.chrom,
              payload.pos,
              payload.refAllele
            )
      ) as LiftoverResult;
      return { result };
    }

    case 'VERIFY_REF_FINGERPRINT': {
      const verified = PlasmidWasmEngine.verify_ref_fingerprint(
        payload.rsid,
        payload.chrom,
        payload.pos,
        payload.refAllele,
        payload.referenceSlice,
        payload.sliceStartPos,
        payload.targetBuild
      );
      return { verified };
    }

    case 'COMPUTE_DENSITY_BINS': {
      const { variants, start, end, numBins = 100 } = payload as {
        variants: ParsedVariant[];
        start: number;
        end: number;
        numBins?: number;
      };
      const span = Math.max(end - start, 1);
      const binSize = span / numBins;
      const bins: DensityBin[] = [];

      for (let i = 0; i < numBins; i++) {
        bins.push({
          start: Math.floor(start + i * binSize),
          end: Math.floor(start + (i + 1) * binSize),
          score: 0,
          count: 0,
          pathogenicCount: 0,
        });
      }

      for (const v of variants) {
        if (v.pos < start || v.pos > end) continue;
        const binIdx = Math.min(
          numBins - 1,
          Math.max(0, Math.floor((v.pos - start) / binSize))
        );
        bins[binIdx].count += 1;
        bins[binIdx].score += v.score || 1.0;
        if (
          v.clinvar &&
          v.clinvar.toLowerCase().includes('pathogenic') &&
          !v.clinvar.toLowerCase().includes('benign') &&
          !v.clinvar.toLowerCase().includes('conflict')
        ) {
          bins[binIdx].pathogenicCount += 1;
        }
      }

      return { bins };
    }

    default:
      throw new Error(`Unknown worker action: ${type}`);
  }
}

const isDedicatedWorkerScope =
  typeof self !== 'undefined' &&
  typeof (self as unknown as { postMessage?: unknown }).postMessage === 'function' &&
  typeof document === 'undefined';

if (isDedicatedWorkerScope) {
  self.onmessage = async (e: MessageEvent) => {
    const { id, type, payload } = e.data;
    try {
      const result = await handleWorkerRequest(type, payload ?? {});
      self.postMessage({ id, success: true, ...result });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'WASM worker error';
      self.postMessage({ id, success: false, error: message });
    }
  };
}
