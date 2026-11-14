import {
  handleWorkerRequest,
  type DensityBin,
  type ParsedVariant,
} from '../workers/genome-decoder.worker.js';
import type {
  AnnotationRecord,
  GenomeAssembly,
  LiftoverResult,
  ParsedLocalPlasmidDataset,
  ParsedVcfDataset,
  PlasmidIndexEntry,
  PyramidIndex,
  SlicingPlan,
  UnifiedGenomicSlice,
  WasmChunkHashInfo,
  WasmHeaderInfo,
  WasmIndexEntryInfo,
  WasmLeafPointerInfo,
  WasmLeafQueryPlan,
  WasmMerkleVerification,
} from '../types/plasmid';

export interface DecodedSlicePayload {
  slice: UnifiedGenomicSlice;
  variants: ParsedVariant[];
  referenceSequence: string | null;
  annotations: AnnotationRecord[];
  chunkHashes: WasmChunkHashInfo[];
}

class DecoderWorkerClient {
  private static instance: DecoderWorkerClient;
  private worker: Worker | null = null;
  private callbacks: Map<
    string,
    { resolve: (val: any) => void; reject: (err: Error) => void }
  > = new Map();
  private reqId = 0;

  private constructor() {
    this.initWorker();
  }

  public static getInstance(): DecoderWorkerClient {
    if (!DecoderWorkerClient.instance) {
      DecoderWorkerClient.instance = new DecoderWorkerClient();
    }
    return DecoderWorkerClient.instance;
  }

  private rejectAllPending(reason: string): void {
    const err = new Error(reason);
    for (const [, cb] of this.callbacks.entries()) {
      cb.reject(err);
    }
    this.callbacks.clear();
  }

  private initWorker(): void {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(
          new URL('../workers/genome-decoder.worker.ts', import.meta.url),
          { type: 'module' }
        );
        this.worker.onmessage = (e: MessageEvent) => {
          const { id, success, error, ...rest } = e.data;
          const cb = this.callbacks.get(id);
          if (cb) {
            this.callbacks.delete(id);
            if (success) {
              cb.resolve(rest);
            } else {
              cb.reject(new Error(error || 'WASM worker operation failed'));
            }
          }
        };
        this.worker.onerror = (err) => {
          console.error('WASM Decoder Worker error:', err);
          this.rejectAllPending(err.message || 'WASM worker runtime failure');
          this.worker?.terminate();
          this.worker = null;
        };
        this.worker.onmessageerror = () => {
          this.rejectAllPending('WASM worker message deserialization failure');
        };
      } catch (err) {
        console.warn('Web Worker unavailable; falling back to main-thread WASM execution', err);
        this.worker = null;
      }
    }
  }

  private async callWorker<T>(type: string, payload: Record<string, any>): Promise<T> {
    if (!this.worker) {
      return (await handleWorkerRequest(type, payload)) as T;
    }

    const id = `wasm_req_${++this.reqId}`;
    return new Promise<T>((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.worker!.postMessage({ id, type, payload });
    });
  }

  public async parseHeader(buffer: Uint8Array): Promise<WasmHeaderInfo> {
    const res = await this.callWorker<{ header: WasmHeaderInfo }>('PARSE_HEADER', {
      buffer,
    });
    return res.header;
  }

  public async parseRootDirectory(buffer: Uint8Array): Promise<WasmLeafPointerInfo[]> {
    const res = await this.callWorker<{ leaves: WasmLeafPointerInfo[] }>(
      'PARSE_ROOT_DIRECTORY',
      { buffer }
    );
    return res.leaves;
  }

  public async queryRootLeaves(
    buffer: Uint8Array,
    chrom: string,
    startPos: number,
    endPos: number
  ): Promise<WasmLeafQueryPlan> {
    const res = await this.callWorker<{ plan: WasmLeafQueryPlan }>(
      'QUERY_ROOT_LEAVES',
      { buffer, chrom, startPos, endPos }
    );
    return res.plan;
  }

  public async parseDirectoryEntries(buffer: Uint8Array): Promise<WasmIndexEntryInfo[]> {
    const res = await this.callWorker<{ entries: WasmIndexEntryInfo[] }>(
      'PARSE_DIRECTORY_ENTRIES',
      { buffer }
    );
    return res.entries;
  }

  public async planRangeSlice(
    buffer: Uint8Array,
    chrom: string,
    startPos: number,
    endPos: number,
    payloadOffset: number,
    chunkSize: number
  ): Promise<SlicingPlan> {
    const res = await this.callWorker<{ plan: SlicingPlan }>('PLAN_RANGE_SLICE', {
      buffer,
      chrom,
      startPos,
      endPos,
      payloadOffset,
      chunkSize,
    });
    return res.plan;
  }

  public async decodePlasmidSlice(
    entries: PlasmidIndexEntry[],
    chunksBuffer: Uint8Array,
    chunkIndices: number[],
    chunkSize: number,
    chrom: string,
    startPos: number,
    endPos: number
  ): Promise<DecodedSlicePayload> {
    return this.callWorker<DecodedSlicePayload>('DECODE_PLASMID_SLICE', {
      entries,
      chunksBuffer,
      chunkIndices,
      chunkSize,
      chrom,
      startPos,
      endPos,
    });
  }

  public async parseVcfChunk(
    buffer: ArrayBuffer | Uint8Array,
    targetChrom?: string,
    windowStart?: number,
    windowEnd?: number
  ): Promise<ParsedVariant[]> {
    const res = await this.callWorker<{ variants: ParsedVariant[] }>(
      'PARSE_VCF_CHUNK',
      { buffer, targetChrom, windowStart, windowEnd }
    );
    return res.variants;
  }

  public async parseVcfDataset(
    buffer: ArrayBuffer | Uint8Array,
    assemblyHint: string = 'GRCh38'
  ): Promise<ParsedVcfDataset> {
    const res = await this.callWorker<{ dataset: ParsedVcfDataset }>(
      'PARSE_VCF_DATASET',
      { buffer, assemblyHint }
    );
    return res.dataset;
  }

  public async parseLocalPlasmid(
    buffer: ArrayBuffer | Uint8Array
  ): Promise<ParsedLocalPlasmidDataset> {
    const res = await this.callWorker<{ dataset: ParsedLocalPlasmidDataset }>(
      'PARSE_LOCAL_PLASMID',
      { buffer }
    );
    return res.dataset;
  }

  public async verifyChunkHash(
    chunkBuffer: Uint8Array,
    expectedHex?: string
  ): Promise<{ verified: boolean; sha256Hex: string }> {
    return this.callWorker<{ verified: boolean; sha256Hex: string }>(
      'VERIFY_CHUNK_HASH',
      { chunkBuffer, expectedHex }
    );
  }

  public async verifyMerkleTree(
    payloadBuffer: Uint8Array,
    chunkSize: number,
    expectedRootHex: string
  ): Promise<WasmMerkleVerification> {
    const res = await this.callWorker<{ verification: WasmMerkleVerification }>(
      'VERIFY_MERKLE_TREE',
      { payloadBuffer, chunkSize, expectedRootHex }
    );
    return res.verification;
  }

  public async getAssemblyOverview(assembly: GenomeAssembly): Promise<PyramidIndex> {
    const res = await this.callWorker<{ pyramid: PyramidIndex }>(
      'GET_ASSEMBLY_OVERVIEW',
      { assembly }
    );
    return res.pyramid;
  }

  public async liftoverCoordinate(
    direction: 'hg19_to_hg38' | 'hg38_to_hg19',
    chrom: string,
    pos: number,
    refAllele: string
  ): Promise<LiftoverResult> {
    const res = await this.callWorker<{ result: LiftoverResult }>(
      'LIFTOVER_COORDINATE',
      { direction, chrom, pos, refAllele }
    );
    return res.result;
  }

  public async verifyRefFingerprint(
    rsid: string,
    chrom: string,
    pos: number,
    refAllele: string,
    referenceSlice: string,
    sliceStartPos: number,
    targetBuild: GenomeAssembly
  ): Promise<boolean> {
    const res = await this.callWorker<{ verified: boolean }>(
      'VERIFY_REF_FINGERPRINT',
      {
        rsid,
        chrom,
        pos,
        refAllele,
        referenceSlice,
        sliceStartPos,
        targetBuild,
      }
    );
    return res.verified;
  }

  public async computeDensityBins(
    variants: ParsedVariant[],
    start: number,
    end: number,
    numBins: number = 100
  ): Promise<DensityBin[]> {
    const res = await this.callWorker<{ bins: DensityBin[] }>(
      'COMPUTE_DENSITY_BINS',
      { variants, start, end, numBins }
    );
    return res.bins;
  }
}

export const decoderClient = DecoderWorkerClient.getInstance();
export type { ParsedVariant, DensityBin };
