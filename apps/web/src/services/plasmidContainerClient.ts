import { decoderClient } from './decoderClient.js';
import { opfs } from './opfs.js';
import type {
  AnnotationRecord,
  ByteRange,
  CatalogVariantItem,
  ContainerMetadata,
  GenomeAssembly,
  ParsedVariant,
  PlasmidIndexEntry,
  PyramidIndex,
  SlicingPlan,
  WasmChunkHashInfo,
  WasmHeaderInfo,
  WasmIndexEntryInfo,
  WasmLeafPointerInfo,
  WasmLeafQueryPlan,
  WasmMerkleVerification,
} from '../types/plasmid';

export const DEFAULT_DATASET_URL = '/api/data/demo.plasmid';
export const DEFAULT_OPFS_FILENAME = 'demo.plasmid';
const HEADER_SIZE = 128;

export type AuditLogType = 'opfs' | 'network' | 'worker';
export type AuditLogger = (message: string, type: AuditLogType) => void;

export interface ContainerSession {
  key: string;
  airgapped: boolean;
  datasetUrl: string;
  opfsFilename: string;
  totalFileSize: number;
  header: WasmHeaderInfo;
  containerAssembly: GenomeAssembly;
  indexBytes: Uint8Array;
  rootLeaves: WasmLeafPointerInfo[];
  flatEntries: WasmIndexEntryInfo[];
  metadata: ContainerMetadata;
  pyramid: PyramidIndex;
  leafCache: Map<string, Uint8Array>;
  chunkCache: Map<number, Uint8Array>;
}

export interface WindowQueryOptions {
  chrom: string;
  startPos: number;
  endPos: number;
  viewAssembly?: GenomeAssembly;
  airgapped?: boolean;
  datasetUrl?: string;
  opfsFilename?: string;
  signal?: AbortSignal;
  onLog?: AuditLogger;
}

export interface WindowQueryResult {
  session: ContainerSession;
  queriedChrom: string;
  queriedStart: number;
  queriedEnd: number;
  containerQueryStart: number;
  containerQueryEnd: number;
  liftoverShiftBp: number | null;
  unmappedLiftoverReason: string | null;
  leafPlan: WasmLeafQueryPlan | null;
  slicingPlan: SlicingPlan | null;
  variants: ParsedVariant[];
  referenceSequence: string | null;
  annotations: AnnotationRecord[];
  matchedEntries: PlasmidIndexEntry[];
  chunkHashes: WasmChunkHashInfo[];
  bytesFetchedThisQuery: number;
  rangeHeadersIssued: string[];
}

function parseTotalSizeFromContentRange(contentRange: string | null): number | null {
  if (!contentRange) return null;
  const match = /\/(\d+)$/.exec(contentRange.trim());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function detectAssemblyFromBuildString(build: string): GenomeAssembly {
  const upper = build.toUpperCase();
  if (upper.includes('37') || upper.includes('19')) {
    return 'GRCh37';
  }
  return 'GRCh38';
}

function formatByteRangeHeader(ranges: ByteRange[]): string {
  if (ranges.length === 0) return 'none (0 B)';
  return `bytes=${ranges.map((r) => `${r.start}-${r.end}`).join(',')}`;
}

class PlasmidContainerClient {
  private sessions = new Map<string, ContainerSession>();
  private pendingSessions = new Map<string, Promise<ContainerSession>>();
  private assemblyPyramidCache = new Map<GenomeAssembly, PyramidIndex>();

  public clearCache(): void {
    this.sessions.clear();
    this.pendingSessions.clear();
  }

  public async getAssemblyPyramid(assembly: GenomeAssembly): Promise<PyramidIndex> {
    const cached = this.assemblyPyramidCache.get(assembly);
    if (cached) return cached;
    const overview = await decoderClient.getAssemblyOverview(assembly);
    this.assemblyPyramidCache.set(assembly, overview);
    return overview;
  }

  private async readByteRange(params: {
    datasetUrl: string;
    opfsFilename: string;
    start: number;
    end: number;
    airgapped: boolean;
    signal?: AbortSignal;
    label: string;
    onLog?: AuditLogger;
  }): Promise<{ bytes: Uint8Array; totalSize: number | null; rangeHeader: string }> {
    const { datasetUrl, opfsFilename, start, end, airgapped, signal, label, onLog } = params;
    const rangeHeader = `bytes=${start}-${end}`;
    const expectedLen = end - start + 1;

    if (airgapped) {
      const exists = await opfs.hasFile(opfsFilename);
      if (!exists) {
        throw new Error(
          `OPFS Airgap is active, but "${opfsFilename}" is not cached locally. Cache the container to OPFS first or switch to Edge Streaming.`
        );
      }
      const info = await opfs.getFileInfo(opfsFilename);
      const buf = await opfs.readRange(opfsFilename, start, end);
      const bytes = new Uint8Array(buf);
      onLog?.(
        `OPFS [${label}] ${rangeHeader} (${bytes.byteLength.toLocaleString()} B)`,
        'opfs'
      );
      return {
        bytes,
        totalSize: info?.size ?? null,
        rangeHeader,
      };
    }

    const res = await fetch(datasetUrl, {
      headers: { Range: rangeHeader },
      signal,
    });

    if (!res.ok && res.status !== 206) {
      throw new Error(
        `HTTP ${res.status} (${res.statusText || 'Range fetch failed'}) for ${datasetUrl} [${rangeHeader}]`
      );
    }

    const rawBuf = await res.arrayBuffer();
    const rawBytes = new Uint8Array(rawBuf);

    if (res.status === 206) {
      const totalSize = parseTotalSizeFromContentRange(res.headers.get('content-range'));
      onLog?.(
        `HTTP 206 [${label}] ${rangeHeader} (${rawBytes.byteLength.toLocaleString()} B)`,
        'network'
      );
      return { bytes: rawBytes, totalSize, rangeHeader };
    }

    // Server returned 200 OK full representation (e.g. plain static host without 206 support)
    const sliced = rawBytes.slice(start, Math.min(rawBytes.byteLength, start + expectedLen));
    onLog?.(
      `HTTP 200 [${label}] sliced ${rangeHeader} (${sliced.byteLength.toLocaleString()} B of ${rawBytes.byteLength.toLocaleString()} B)`,
      'network'
    );
    return {
      bytes: sliced,
      totalSize: rawBytes.byteLength,
      rangeHeader,
    };
  }

  public async getSession(options?: {
    airgapped?: boolean;
    datasetUrl?: string;
    opfsFilename?: string;
    signal?: AbortSignal;
    onLog?: AuditLogger;
  }): Promise<ContainerSession> {
    const airgapped = options?.airgapped ?? false;
    const datasetUrl = options?.datasetUrl ?? DEFAULT_DATASET_URL;
    const opfsFilename = options?.opfsFilename ?? DEFAULT_OPFS_FILENAME;
    const key = `${airgapped ? 'opfs' : 'edge'}:${airgapped ? opfsFilename : datasetUrl}`;

    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }

    const inflight = this.pendingSessions.get(key);
    if (inflight) {
      return inflight;
    }

    const promise = (async (): Promise<ContainerSession> => {
      // 1. Exact 128-byte .plasmid binary header
      const headerRes = await this.readByteRange({
        datasetUrl,
        opfsFilename,
        start: 0,
        end: HEADER_SIZE - 1,
        airgapped,
        signal: options?.signal,
        label: 'Header 128B',
        onLog: options?.onLog,
      });

      const header = await decoderClient.parseHeader(headerRes.bytes);
      const containerAssembly = detectAssemblyFromBuildString(header.reference_build);
      const computedTotalSize =
        headerRes.totalSize ?? header.payload_offset + header.total_payload_bytes;

      options?.onLog?.(
        `WASM parsed .plasmid v${header.version} (${header.reference_build}, ${header.is_hierarchical ? '2-stage hierarchical' : 'flat'} index, ${header.total_chunks} chunks, root=${header.root_hash_hex.slice(0, 12)}…)`,
        'worker'
      );

      // 2. Exact Root Directory (hierarchical) or Flat Directory bytes
      let indexBytes: Uint8Array = new Uint8Array(0);
      let rootLeaves: WasmLeafPointerInfo[] = [];
      let flatEntries: WasmIndexEntryInfo[] = [];

      if (header.index_length > 0) {
        const idxRes = await this.readByteRange({
          datasetUrl,
          opfsFilename,
          start: header.index_offset,
          end: header.index_offset + header.index_length - 1,
          airgapped,
          signal: options?.signal,
          label: header.is_hierarchical ? 'Root Directory' : 'Flat Directory',
          onLog: options?.onLog,
        });
        indexBytes = idxRes.bytes;

        if (header.is_hierarchical) {
          rootLeaves = await decoderClient.parseRootDirectory(indexBytes);
        } else {
          flatEntries = await decoderClient.parseDirectoryEntries(indexBytes);
        }
      }

      // 3. Exact Metadata JSON (including multi-scale PyramidIndex when embedded)
      let metadata: ContainerMetadata = {};
      if (header.metadata_length > 0) {
        const metaRes = await this.readByteRange({
          datasetUrl,
          opfsFilename,
          start: header.metadata_offset,
          end: header.metadata_offset + header.metadata_length - 1,
          airgapped,
          signal: options?.signal,
          label: 'Container Metadata',
          onLog: options?.onLog,
        });
        const metaText = new TextDecoder('utf-8').decode(metaRes.bytes);
        try {
          metadata = JSON.parse(metaText) as ContainerMetadata;
        } catch {
          metadata = {};
        }
      }

      const pyramid =
        metadata.pyramid ?? (await this.getAssemblyPyramid(containerAssembly));

      const session: ContainerSession = {
        key,
        airgapped,
        datasetUrl,
        opfsFilename,
        totalFileSize: computedTotalSize,
        header,
        containerAssembly,
        indexBytes,
        rootLeaves,
        flatEntries,
        metadata,
        pyramid,
        leafCache: new Map(),
        chunkCache: new Map(),
      };

      this.sessions.set(key, session);
      return session;
    })().finally(() => {
      this.pendingSessions.delete(key);
    });

    this.pendingSessions.set(key, promise);
    return promise;
  }

  private async ensureChunksCached(
    session: ContainerSession,
    slicingPlan: SlicingPlan,
    signal?: AbortSignal,
    onLog?: AuditLogger
  ): Promise<{
    chunksConcat: Uint8Array;
    bytesFetched: number;
    rangeHeaders: string[];
  }> {
    const chunkSize = session.header.chunk_size;
    const payloadOffset = session.header.payload_offset;
    let bytesFetched = 0;
    const rangeHeaders: string[] = [];

    // Identify which chunks are not yet in session.chunkCache
    const missingIndices = slicingPlan.chunk_indices.filter(
      (idx) => !session.chunkCache.has(idx)
    );

    if (missingIndices.length > 0) {
      // Coalesce contiguous missing chunks into minimal HTTP Range requests
      const sorted = [...missingIndices].sort((a, b) => a - b);
      const runs: { firstIdx: number; count: number }[] = [];
      for (const idx of sorted) {
        const last = runs[runs.length - 1];
        if (last && last.firstIdx + last.count === idx) {
          last.count += 1;
        } else {
          runs.push({ firstIdx: idx, count: 1 });
        }
      }

      for (const run of runs) {
        const byteStart = payloadOffset + run.firstIdx * chunkSize;
        const byteEnd = byteStart + run.count * chunkSize - 1;
        const chunkRes = await this.readByteRange({
          datasetUrl: session.datasetUrl,
          opfsFilename: session.opfsFilename,
          start: byteStart,
          end: byteEnd,
          airgapped: session.airgapped,
          signal,
          label:
            run.count === 1
              ? `Chunk #${run.firstIdx}`
              : `Chunks #${run.firstIdx}..#${run.firstIdx + run.count - 1}`,
          onLog,
        });

        bytesFetched += chunkRes.bytes.byteLength;
        rangeHeaders.push(chunkRes.rangeHeader);

        for (let i = 0; i < run.count; i++) {
          const slice = chunkRes.bytes.slice(i * chunkSize, (i + 1) * chunkSize);
          session.chunkCache.set(run.firstIdx + i, slice);
        }
      }
    } else if (slicingPlan.chunk_indices.length > 0) {
      onLog?.(
        `Chunk cache hit for #${slicingPlan.chunk_indices.join(', #')} (0 network bytes)`,
        'worker'
      );
    }

    const concat = new Uint8Array(slicingPlan.chunk_indices.length * chunkSize);
    slicingPlan.chunk_indices.forEach((chunkIdx, pos) => {
      const cached = session.chunkCache.get(chunkIdx);
      if (cached) {
        concat.set(cached, pos * chunkSize);
      }
    });

    return { chunksConcat: concat, bytesFetched, rangeHeaders };
  }

  public async queryWindow(options: WindowQueryOptions): Promise<WindowQueryResult> {
    const session = await this.getSession({
      airgapped: options.airgapped,
      datasetUrl: options.datasetUrl,
      opfsFilename: options.opfsFilename,
      signal: options.signal,
      onLog: options.onLog,
    });

    const viewAssembly = options.viewAssembly ?? session.containerAssembly;
    let containerStart = Math.max(1, Math.floor(options.startPos));
    let containerEnd = Math.max(containerStart, Math.floor(options.endPos));
    let liftoverShiftBp: number | null = null;

    // Translate coordinates via Rust WASM LiftoverEngine if viewing assembly differs from container build
    if (viewAssembly !== session.containerAssembly) {
      const midpoint = Math.round((containerStart + containerEnd) / 2);
      const direction =
        viewAssembly === 'GRCh37' && session.containerAssembly === 'GRCh38'
          ? 'hg19_to_hg38'
          : 'hg38_to_hg19';

      try {
        const lifted = await decoderClient.liftoverCoordinate(
          direction,
          options.chrom,
          midpoint,
          'N'
        );
        liftoverShiftBp = lifted.lifted_pos - midpoint;
        containerStart = Math.max(1, containerStart + liftoverShiftBp);
        containerEnd = Math.max(containerStart, containerEnd + liftoverShiftBp);
        options.onLog?.(
          `WASM Liftover (${viewAssembly} -> ${session.containerAssembly}): ${options.chrom}:${options.startPos.toLocaleString()}-${options.endPos.toLocaleString()} -> ${containerStart.toLocaleString()}-${containerEnd.toLocaleString()}`,
          'worker'
        );
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        options.onLog?.(
          `Liftover unmapped for ${options.chrom}:${midpoint.toLocaleString()} (${viewAssembly}): ${reason}`,
          'worker'
        );
        return {
          session,
          queriedChrom: options.chrom,
          queriedStart: options.startPos,
          queriedEnd: options.endPos,
          containerQueryStart: containerStart,
          containerQueryEnd: containerEnd,
          liftoverShiftBp: null,
          unmappedLiftoverReason: reason,
          leafPlan: null,
          slicingPlan: null,
          variants: [],
          referenceSequence: null,
          annotations: [],
          matchedEntries: [],
          chunkHashes: [],
          bytesFetchedThisQuery: 0,
          rangeHeadersIssued: [],
        };
      }
    }

    let bytesFetchedThisQuery = 0;
    const rangeHeadersIssued: string[] = [];
    let leafPlan: WasmLeafQueryPlan | null = null;
    let directoryBytesForSlice: Uint8Array;

    if (session.header.is_hierarchical) {
      leafPlan = await decoderClient.queryRootLeaves(
        session.indexBytes,
        options.chrom,
        containerStart,
        containerEnd
      );

      if (leafPlan.leaves.length === 0) {
        options.onLog?.(
          `Root directory miss on ${options.chrom}:${containerStart.toLocaleString()}-${containerEnd.toLocaleString()} (0 leaf/chunk bytes needed)`,
          'worker'
        );
        return {
          session,
          queriedChrom: options.chrom,
          queriedStart: options.startPos,
          queriedEnd: options.endPos,
          containerQueryStart: containerStart,
          containerQueryEnd: containerEnd,
          liftoverShiftBp,
          unmappedLiftoverReason: null,
          leafPlan,
          slicingPlan: null,
          variants: [],
          referenceSequence: null,
          annotations: [],
          matchedEntries: [],
          chunkHashes: [],
          bytesFetchedThisQuery: 0,
          rangeHeadersIssued: [],
        };
      }

      const leafBuffers: Uint8Array[] = [];
      let totalLeafLen = 0;

      for (const leaf of leafPlan.leaves) {
        const cacheKey = `${leaf.leaf_offset}:${leaf.leaf_length}`;
        let leafBuf = session.leafCache.get(cacheKey);
        if (!leafBuf) {
          const leafRes = await this.readByteRange({
            datasetUrl: session.datasetUrl,
            opfsFilename: session.opfsFilename,
            start: leaf.leaf_offset,
            end: leaf.leaf_offset + leaf.leaf_length - 1,
            airgapped: session.airgapped,
            signal: options.signal,
            label: `Leaf Dir (${leaf.chrom_name})`,
            onLog: options.onLog,
          });
          leafBuf = leafRes.bytes;
          session.leafCache.set(cacheKey, leafBuf);
          bytesFetchedThisQuery += leafBuf.byteLength;
          rangeHeadersIssued.push(leafRes.rangeHeader);
        }
        leafBuffers.push(leafBuf);
        totalLeafLen += leafBuf.byteLength;
      }

      directoryBytesForSlice = new Uint8Array(totalLeafLen);
      let offset = 0;
      for (const buf of leafBuffers) {
        directoryBytesForSlice.set(buf, offset);
        offset += buf.byteLength;
      }
    } else {
      directoryBytesForSlice = session.indexBytes;
    }

    const slicingPlan = await decoderClient.planRangeSlice(
      directoryBytesForSlice,
      options.chrom,
      containerStart,
      containerEnd,
      session.header.payload_offset,
      session.header.chunk_size
    );

    if (slicingPlan.chunk_indices.length === 0 || slicingPlan.entries.length === 0) {
      options.onLog?.(
        `Leaf directory queried: no overlapping blocks in ${options.chrom}:${containerStart.toLocaleString()}-${containerEnd.toLocaleString()}`,
        'worker'
      );
      return {
        session,
        queriedChrom: options.chrom,
        queriedStart: options.startPos,
        queriedEnd: options.endPos,
        containerQueryStart: containerStart,
        containerQueryEnd: containerEnd,
        liftoverShiftBp,
        unmappedLiftoverReason: null,
        leafPlan,
        slicingPlan,
        variants: [],
        referenceSequence: null,
        annotations: [],
        matchedEntries: [],
        chunkHashes: [],
        bytesFetchedThisQuery,
        rangeHeadersIssued,
      };
    }

    const chunkFetch = await this.ensureChunksCached(
      session,
      slicingPlan,
      options.signal,
      options.onLog
    );
    bytesFetchedThisQuery += chunkFetch.bytesFetched;
    rangeHeadersIssued.push(...chunkFetch.rangeHeaders);

    const decoded = await decoderClient.decodePlasmidSlice(
      slicingPlan.entries,
      chunkFetch.chunksConcat,
      slicingPlan.chunk_indices,
      session.header.chunk_size,
      options.chrom,
      containerStart,
      containerEnd
    );

    let variants = decoded.variants;
    if (viewAssembly !== session.containerAssembly && liftoverShiftBp !== null) {
      const reverseDir =
        session.containerAssembly === 'GRCh38' && viewAssembly === 'GRCh37'
          ? 'hg38_to_hg19'
          : 'hg19_to_hg38';
      const liftedVariants: ParsedVariant[] = [];
      for (const v of variants) {
        try {
          const rev = await decoderClient.liftoverCoordinate(
            reverseDir,
            v.chrom,
            v.pos,
            v.ref
          );
          liftedVariants.push({ ...v, pos: rev.lifted_pos });
        } catch {
          liftedVariants.push({ ...v, pos: v.pos - liftoverShiftBp });
        }
      }
      variants = liftedVariants;
    }

    options.onLog?.(
      `WASM decoded ${variants.length} variant(s), ${decoded.annotations.length} note(s), SHA-256 verified ${decoded.chunkHashes.length} chunk(s)`,
      'worker'
    );

    return {
      session,
      queriedChrom: options.chrom,
      queriedStart: options.startPos,
      queriedEnd: options.endPos,
      containerQueryStart: containerStart,
      containerQueryEnd: containerEnd,
      liftoverShiftBp,
      unmappedLiftoverReason: null,
      leafPlan,
      slicingPlan,
      variants,
      referenceSequence: decoded.referenceSequence,
      annotations: decoded.annotations,
      matchedEntries: slicingPlan.entries,
      chunkHashes: decoded.chunkHashes,
      bytesFetchedThisQuery,
      rangeHeadersIssued,
    };
  }

  /**
   * Discovers and decodes all VCF variant entries stored inside the loaded .plasmid container.
   */
  public async loadCatalogVariants(options?: {
    airgapped?: boolean;
    datasetUrl?: string;
    opfsFilename?: string;
    signal?: AbortSignal;
    onLog?: AuditLogger;
  }): Promise<{ session: ContainerSession; items: CatalogVariantItem[] }> {
    const session = await this.getSession(options);
    const allEntryRecords: {
      info: WasmIndexEntryInfo;
      leaf?: WasmLeafPointerInfo;
    }[] = [];

    if (session.header.is_hierarchical) {
      for (const leaf of session.rootLeaves) {
        const cacheKey = `${leaf.leaf_offset}:${leaf.leaf_length}`;
        let leafBuf = session.leafCache.get(cacheKey);
        if (!leafBuf) {
          const leafRes = await this.readByteRange({
            datasetUrl: session.datasetUrl,
            opfsFilename: session.opfsFilename,
            start: leaf.leaf_offset,
            end: leaf.leaf_offset + leaf.leaf_length - 1,
            airgapped: session.airgapped,
            signal: options?.signal,
            label: `Leaf Dir (${leaf.chrom_name})`,
            onLog: options?.onLog,
          });
          leafBuf = leafRes.bytes;
          session.leafCache.set(cacheKey, leafBuf);
        }
        const parsed = await decoderClient.parseDirectoryEntries(leafBuf);
        for (const entryInfo of parsed) {
          allEntryRecords.push({ info: entryInfo, leaf });
        }
      }
    } else {
      for (const entryInfo of session.flatEntries) {
        allEntryRecords.push({ info: entryInfo });
      }
    }

    const vcfRecords = allEntryRecords.filter(
      (r) => r.info.entry.entry_type === 'VcfVariant'
    );

    const items: CatalogVariantItem[] = [];
    for (const rec of vcfRecords) {
      const { chrom_name, entry } = rec.info;
      const windowRes = await this.queryWindow({
        chrom: chrom_name,
        startPos: entry.start_pos,
        endPos: entry.end_pos,
        viewAssembly: session.containerAssembly,
        airgapped: session.airgapped,
        datasetUrl: session.datasetUrl,
        opfsFilename: session.opfsFilename,
        signal: options?.signal,
        onLog: options?.onLog,
      });

      const byteRangeHeader = windowRes.slicingPlan
        ? formatByteRangeHeader(windowRes.slicingPlan.byte_ranges)
        : 'none';
      const bytesTransferred = windowRes.slicingPlan?.total_download_bytes ?? 0;

      for (const variant of windowRes.variants) {
        items.push({
          key: `${variant.chrom}:${variant.pos}:${variant.ref}:${variant.alt}`,
          variant,
          entry,
          leaf: rec.leaf,
          byteRangeHeader,
          chunkIndices: windowRes.slicingPlan?.chunk_indices ?? [],
          chunkHashes: windowRes.chunkHashes,
          annotations: windowRes.annotations,
          bytesTransferred,
        });
      }
    }

    return { session, items };
  }

  /**
   * Verifies full SHA-256 BEP 52 Merkle Root over all payload chunks of the loaded .plasmid container.
   */
  public async verifyContainerMerkle(options?: {
    airgapped?: boolean;
    datasetUrl?: string;
    opfsFilename?: string;
    signal?: AbortSignal;
    onLog?: AuditLogger;
  }): Promise<{
    verification: WasmMerkleVerification;
    elapsedMs: number;
    session: ContainerSession;
  }> {
    const started = performance.now();
    const session = await this.getSession(options);
    const { header } = session;

    if (header.total_payload_bytes === 0) {
      const verification = await decoderClient.verifyMerkleTree(
        new Uint8Array(0),
        header.chunk_size,
        header.root_hash_hex
      );
      return {
        verification,
        elapsedMs: Math.round((performance.now() - started) * 10) / 10,
        session,
      };
    }

    const payloadStart = header.payload_offset;
    const payloadEnd = payloadStart + header.total_payload_bytes - 1;
    const payloadRes = await this.readByteRange({
      datasetUrl: session.datasetUrl,
      opfsFilename: session.opfsFilename,
      start: payloadStart,
      end: payloadEnd,
      airgapped: session.airgapped,
      signal: options?.signal,
      label: `Merkle Payload (${header.total_chunks} chunks)`,
      onLog: options?.onLog,
    });

    const verification = await decoderClient.verifyMerkleTree(
      payloadRes.bytes,
      header.chunk_size,
      header.root_hash_hex
    );

    return {
      verification,
      elapsedMs: Math.round((performance.now() - started) * 10) / 10,
      session,
    };
  }
}

export const plasmidContainerClient = new PlasmidContainerClient();
