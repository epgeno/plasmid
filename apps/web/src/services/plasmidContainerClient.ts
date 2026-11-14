import { decoderClient } from './decoderClient.js';
import { detectVaultFileKind, opfs, VAULT_DIR_NAME } from './opfs.js';
import type {
  AnnotationRecord,
  ByteRange,
  CatalogVariantItem,
  ClinVarIntersectionReport,
  ContainerMetadata,
  DataSourceMode,
  GenomeAssembly,
  ParsedVariant,
  ParsedVcfDataset,
  PlasmidIndexEntry,
  PyramidIndex,
  SlicingPlan,
  VcfVariantRecord,
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
const MAX_CATALOG_SELECTOR_ITEMS = 500;

export type AuditLogType = 'opfs' | 'network' | 'worker';
export type AuditLogger = (message: string, type: AuditLogType) => void;
export type ContainerSourceKind = 'remote-plasmid' | 'opfs-plasmid' | 'local-vcf';

export interface ContainerSession {
  key: string;
  sourceMode: DataSourceMode;
  sourceKind: ContainerSourceKind;
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
  vcfDataset?: ParsedVcfDataset;
  localPlasmidVariants?: VcfVariantRecord[];
  leafCache: Map<string, Uint8Array>;
  chunkCache: Map<number, Uint8Array>;
}

export interface SessionLookupOptions {
  sourceMode?: DataSourceMode;
  airgapped?: boolean;
  datasetUrl?: string;
  opfsFilename?: string;
  signal?: AbortSignal;
  onLog?: AuditLogger;
}

export interface WindowQueryOptions extends SessionLookupOptions {
  chrom: string;
  startPos: number;
  endPos: number;
  viewAssembly?: GenomeAssembly;
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

function normalizeChromName(chrom: string): string {
  const trimmed = chrom.trim();
  const clean = trimmed.replace(/^chr/i, '').toUpperCase();
  if (clean === 'MT') return 'chrM';
  if (clean === 'X' || clean === 'Y' || clean === 'M') return `chr${clean}`;
  const num = Number(clean);
  if (Number.isInteger(num) && num >= 1 && num <= 22) {
    return `chr${num}`;
  }
  return trimmed;
}

class PlasmidContainerClient {
  private sessions = new Map<string, ContainerSession>();
  private pendingSessions = new Map<string, Promise<ContainerSession>>();
  private assemblyPyramidCache = new Map<GenomeAssembly, PyramidIndex>();
  private cacheGeneration = 0;

  public clearCache(): void {
    this.cacheGeneration += 1;
    this.sessions.clear();
    this.pendingSessions.clear();
  }

  public evictFile(opfsFilename: string): void {
    this.cacheGeneration += 1;
    for (const [key, session] of this.sessions.entries()) {
      if (session.opfsFilename === opfsFilename || key.endsWith(`:${opfsFilename}`)) {
        this.sessions.delete(key);
      }
    }
    for (const key of this.pendingSessions.keys()) {
      if (key.endsWith(`:${opfsFilename}`)) {
        this.pendingSessions.delete(key);
      }
    }
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
    signal?.throwIfAborted();
    const rangeHeader = `bytes=${start}-${end}`;
    const expectedLen = end - start + 1;

    if (airgapped) {
      const exists = await opfs.hasFile(opfsFilename);
      if (!exists) {
        throw new Error(
          `OPFS Airgap is active, but "${opfsFilename}" is not cached locally. Cache or upload a file to OPFS first.`
        );
      }
      const info = await opfs.getFileInfo(opfsFilename);
      const buf = await opfs.readRange(opfsFilename, start, end);
      signal?.throwIfAborted();
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

  public async getSession(options?: SessionLookupOptions): Promise<ContainerSession> {
    const opfsFilename = options?.opfsFilename ?? DEFAULT_OPFS_FILENAME;
    const isVaultPath =
      options?.sourceMode === 'vault' || opfsFilename.startsWith(`${VAULT_DIR_NAME}/`);
    const sourceMode: DataSourceMode = isVaultPath ? 'vault' : 'public';
    const airgapped = isVaultPath ? true : (options?.airgapped ?? false);
    const datasetUrl = options?.datasetUrl ?? DEFAULT_DATASET_URL;
    const key = isVaultPath
      ? `vault:${opfsFilename}`
      : `${airgapped ? 'opfs' : 'edge'}:${airgapped ? opfsFilename : datasetUrl}`;

    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }

    const inflight = this.pendingSessions.get(key);
    if (inflight) {
      return inflight;
    }

    const startGen = this.cacheGeneration;
    const promise = (async (): Promise<ContainerSession> => {
      if (isVaultPath) {
        const exists = await opfs.hasFile(opfsFilename);
        if (!exists) {
          throw new Error(`Vault file "${opfsFilename}" was not found in browser OPFS.`);
        }

        const rawBuf = await opfs.readFile(opfsFilename);
        const rawBytes = new Uint8Array(rawBuf);
        const vaultKind = detectVaultFileKind(opfsFilename, rawBytes);

        if (vaultKind === 'vcf') {
          options?.onLog?.(
            `OPFS [Vault VCF] ${opfsFilename} (${rawBytes.byteLength.toLocaleString()} B)`,
            'opfs'
          );

          const vcfDataset = await decoderClient.parseVcfDataset(rawBytes, 'GRCh38');
          const containerAssembly = detectAssemblyFromBuildString(vcfDataset.reference_build);

          options?.onLog?.(
            `WASM parsed local VCF (${vcfDataset.reference_build}, ${vcfDataset.variants.length} variants across ${vcfDataset.chrom_index.length} chromosomes, sha256=${vcfDataset.sha256_hex.slice(0, 12)}…)`,
            'worker'
          );

          const syntheticHeader: WasmHeaderInfo = {
            version: 1,
            flags: 0,
            is_hierarchical: false,
            reference_build: vcfDataset.reference_build,
            root_hash_hex: vcfDataset.sha256_hex,
            root_hash_bytes: [],
            chunk_size: Math.max(1, vcfDataset.byte_length),
            total_chunks: 1,
            total_payload_bytes: vcfDataset.byte_length,
            index_offset: 0,
            index_length: vcfDataset.chrom_index.length * 32,
            metadata_offset: 0,
            metadata_length: 0,
            payload_offset: 0,
          };

          const metadata: ContainerMetadata = {
            generator: 'plasmid-vault WASM VCF Decoder',
            license: 'Private OPFS Vault (Air-Gapped)',
            reference_build: vcfDataset.reference_build,
            pyramid: vcfDataset.pyramid,
          };

          const flatEntries: WasmIndexEntryInfo[] = vcfDataset.chrom_index.map((ci) => ({
            chrom_id: ci.chrom_id,
            chrom_name: ci.chrom_name,
            entry: {
              chrom_id: ci.chrom_id,
              entry_type: 'VcfVariant',
              flags: 0,
              start_pos: ci.min_pos,
              end_pos: ci.max_pos,
              chunk_start: 0,
              chunk_count: 1,
              payload_bytes: vcfDataset.byte_length,
            },
          }));

          const vcfSession: ContainerSession = {
            key,
            sourceMode: 'vault',
            sourceKind: 'local-vcf',
            airgapped: true,
            datasetUrl: '',
            opfsFilename,
            totalFileSize: vcfDataset.byte_length,
            header: syntheticHeader,
            containerAssembly,
            indexBytes: new Uint8Array(0),
            rootLeaves: [],
            flatEntries,
            metadata,
            pyramid: vcfDataset.pyramid,
            vcfDataset,
            leafCache: new Map(),
            chunkCache: new Map(),
          };

          if (this.cacheGeneration === startGen) {
            this.sessions.set(key, vcfSession);
          }
          return vcfSession;
        }

        // Local .plasmid inside OPFS Private Vault
        options?.onLog?.(
          `OPFS [Vault .plasmid] ${opfsFilename} (${rawBytes.byteLength.toLocaleString()} B)`,
          'opfs'
        );
        const parsedLocal = await decoderClient.parseLocalPlasmid(rawBytes);
        if (!parsedLocal.merkle.verified) {
          throw new Error(
            `Merkle root integrity check failed for "${opfsFilename}" (expected ${parsedLocal.merkle.expected_root_hex.slice(0, 16)}…, computed ${parsedLocal.merkle.calculated_root_hex.slice(0, 16)}…)`
          );
        }

        const containerAssembly = detectAssemblyFromBuildString(
          parsedLocal.header.reference_build
        );
        let metadata: ContainerMetadata = {};
        try {
          metadata = JSON.parse(parsedLocal.metadata_json) as ContainerMetadata;
        } catch {
          metadata = {};
        }

        const idxStart = parsedLocal.header.index_offset;
        const idxEnd = idxStart + parsedLocal.header.index_length;
        const indexBytes = rawBytes.slice(idxStart, idxEnd);

        options?.onLog?.(
          `WASM parsed .plasmid v${parsedLocal.header.version} (${parsedLocal.header.reference_build}, ${parsedLocal.header.is_hierarchical ? '2-stage hierarchical' : 'flat'} index, ${parsedLocal.header.total_chunks} chunks, root=${parsedLocal.header.root_hash_hex.slice(0, 12)}…)`,
          'worker'
        );

        const localPlasmidSession: ContainerSession = {
          key,
          sourceMode: 'vault',
          sourceKind: 'opfs-plasmid',
          airgapped: true,
          datasetUrl: '',
          opfsFilename,
          totalFileSize: rawBytes.byteLength,
          header: parsedLocal.header,
          containerAssembly,
          indexBytes,
          rootLeaves: parsedLocal.leaves,
          flatEntries: parsedLocal.entries,
          metadata,
          pyramid: parsedLocal.pyramid,
          localPlasmidVariants: parsedLocal.raw_variants,
          leafCache: new Map(),
          chunkCache: new Map(),
        };

        if (this.cacheGeneration === startGen) {
          this.sessions.set(key, localPlasmidSession);
        }
        return localPlasmidSession;
      }

      // Public container path (Edge HTTP 206 Range or cached demo.plasmid in OPFS)
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
        sourceMode,
        sourceKind: airgapped ? 'opfs-plasmid' : 'remote-plasmid',
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

      if (this.cacheGeneration === startGen) {
        this.sessions.set(key, session);
      }
      return session;
    })().finally(() => {
      if (this.pendingSessions.get(key) === promise) {
        this.pendingSessions.delete(key);
      }
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

    const missingIndices = slicingPlan.chunk_indices.filter(
      (idx) => !session.chunkCache.has(idx)
    );

    if (missingIndices.length > 0) {
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
      sourceMode: options.sourceMode,
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

    // Air-gapped Local VCF Vault fast coordinate index query (0 network requests)
    if (session.sourceKind === 'local-vcf' && session.vcfDataset) {
      const normChrom = normalizeChromName(options.chrom);
      const chromIdx = session.vcfDataset.chrom_index.find(
        (ci) => ci.chrom_name.toLowerCase() === normChrom.toLowerCase()
      );

      if (!chromIdx || containerEnd < chromIdx.min_pos || containerStart > chromIdx.max_pos) {
        options.onLog?.(
          `Vault VCF coordinate index miss on ${normChrom}:${containerStart.toLocaleString()}-${containerEnd.toLocaleString()} (0 network bytes)`,
          'opfs'
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
          leafPlan: null,
          slicingPlan: {
            chrom_id: chromIdx?.chrom_id ?? 0,
            start_pos: containerStart,
            end_pos: containerEnd,
            chunk_indices: [],
            byte_ranges: [],
            entries: [],
            total_chunk_bytes: 0,
            total_download_bytes: 0,
          },
          variants: [],
          referenceSequence: null,
          annotations: [],
          matchedEntries: [],
          chunkHashes: [],
          bytesFetchedThisQuery: 0,
          rangeHeadersIssued: [],
        };
      }

      const chromSlice = session.vcfDataset.variants.slice(
        chromIdx.start_index,
        chromIdx.end_index + 1
      );
      let matchedVariants = chromSlice.filter((v) => {
        const varEnd = v.pos + Math.max(1, v.ref.length) - 1;
        return v.pos <= containerEnd && varEnd >= containerStart;
      });

      if (viewAssembly !== session.containerAssembly && liftoverShiftBp !== null) {
        const reverseDir =
          session.containerAssembly === 'GRCh38' && viewAssembly === 'GRCh37'
            ? 'hg38_to_hg19'
            : 'hg19_to_hg38';
        const liftedVariants: ParsedVariant[] = [];
        for (const v of matchedVariants) {
          options.signal?.throwIfAborted();
          try {
            const rev = await decoderClient.liftoverCoordinate(
              reverseDir,
              v.chrom,
              v.pos,
              v.ref
            );
            if (rev.lifted_pos >= 1) {
              liftedVariants.push({ ...v, pos: rev.lifted_pos });
            }
          } catch {
            // Fail-closed: omit variants outside verified Liftover intervals instead of fabricating coordinates
          }
        }
        matchedVariants = liftedVariants;
      }

      const matchedEntry: PlasmidIndexEntry = {
        chrom_id: chromIdx.chrom_id,
        entry_type: 'VcfVariant',
        flags: 0,
        start_pos: chromIdx.min_pos,
        end_pos: chromIdx.max_pos,
        chunk_start: 0,
        chunk_count: 1,
        payload_bytes: session.vcfDataset.byte_length,
      };

      const chunkHashes: WasmChunkHashInfo[] = [
        {
          chunk_index: 0,
          byte_length: session.vcfDataset.byte_length,
          sha256_hex: session.vcfDataset.sha256_hex,
        },
      ];

      const slicingPlan: SlicingPlan = {
        chrom_id: chromIdx.chrom_id,
        start_pos: containerStart,
        end_pos: containerEnd,
        chunk_indices: [0],
        byte_ranges: [
          {
            start: 0,
            end: Math.max(0, session.vcfDataset.byte_length - 1),
          },
        ],
        entries: matchedVariants.length > 0 ? [matchedEntry] : [],
        total_chunk_bytes: session.vcfDataset.byte_length,
        total_download_bytes: 0,
      };

      options.onLog?.(
        `OPFS Vault sliced ${matchedVariants.length} variant(s) on ${normChrom} (0 network bytes)`,
        'opfs'
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
        leafPlan: null,
        slicingPlan,
        variants: matchedVariants,
        referenceSequence: null,
        annotations: [],
        matchedEntries: matchedVariants.length > 0 ? [matchedEntry] : [],
        chunkHashes,
        bytesFetchedThisQuery: 0,
        rangeHeadersIssued: [],
      };
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

    options.signal?.throwIfAborted();
    let variants = decoded.variants;
    if (viewAssembly !== session.containerAssembly && liftoverShiftBp !== null) {
      const reverseDir =
        session.containerAssembly === 'GRCh38' && viewAssembly === 'GRCh37'
          ? 'hg38_to_hg19'
          : 'hg19_to_hg38';
      const liftedVariants: ParsedVariant[] = [];
      for (const v of variants) {
        options.signal?.throwIfAborted();
        try {
          const rev = await decoderClient.liftoverCoordinate(
            reverseDir,
            v.chrom,
            v.pos,
            v.ref
          );
          if (rev.lifted_pos >= 1) {
            liftedVariants.push({ ...v, pos: rev.lifted_pos });
          }
        } catch {
          // Fail-closed: omit variants outside verified Liftover intervals instead of fabricating coordinates
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
   * Discovers and decodes VCF variant entries stored inside the loaded .plasmid or OPFS Vault VCF.
   */
  public async loadCatalogVariants(
    options?: SessionLookupOptions
  ): Promise<{ session: ContainerSession; items: CatalogVariantItem[] }> {
    const session = await this.getSession(options);

    if (session.sourceKind === 'local-vcf' && session.vcfDataset) {
      const chunkHashes: WasmChunkHashInfo[] = [
        {
          chunk_index: 0,
          byte_length: session.vcfDataset.byte_length,
          sha256_hex: session.vcfDataset.sha256_hex,
        },
      ];
      const chromIdxMap = new Map(
        session.vcfDataset.chrom_index.map((ci) => [ci.chrom_name, ci])
      );

      const seenKeys = new Set<string>();
      const items: CatalogVariantItem[] = [];
      for (const variant of session.vcfDataset.variants) {
        if (items.length >= MAX_CATALOG_SELECTOR_ITEMS) break;
        const itemKey = `${variant.chrom}:${variant.pos}:${variant.ref}:${variant.alt}`;
        if (seenKeys.has(itemKey)) continue;
        seenKeys.add(itemKey);

        const ci = chromIdxMap.get(variant.chrom);
        const entry: PlasmidIndexEntry = {
          chrom_id: ci?.chrom_id ?? 0,
          entry_type: 'VcfVariant',
          flags: 0,
          start_pos: ci?.min_pos ?? variant.pos,
          end_pos: ci?.max_pos ?? variant.pos,
          chunk_start: 0,
          chunk_count: 1,
          payload_bytes: session.vcfDataset.byte_length,
        };
        items.push({
          key: itemKey,
          variant,
          entry,
          byteRangeHeader: `OPFS ${session.opfsFilename} (0 network B)`,
          chunkIndices: [0],
          chunkHashes,
          annotations: [],
          bytesTransferred: 0,
        });
      }

      return { session, items };
    }

    const allEntryRecords: {
      info: WasmIndexEntryInfo;
      leaf?: WasmLeafPointerInfo;
    }[] = [];

    if (session.header.is_hierarchical && session.flatEntries.length === 0) {
      const priorityOrder = [
        'chr7',
        'chr17',
        'chr13',
        'chr19',
        'chr11',
        'chr6',
        'chr12',
        'chr1',
      ];
      const leavesToSample =
        session.rootLeaves.length <= 8
          ? session.rootLeaves
          : [...session.rootLeaves]
              .sort((a, b) => {
                const ia = priorityOrder.indexOf(a.chrom_name);
                const ib = priorityOrder.indexOf(b.chrom_name);
                if (ia !== -1 && ib !== -1) return ia - ib;
                if (ia !== -1) return -1;
                if (ib !== -1) return 1;
                return a.chrom_id - b.chrom_id;
              })
              .slice(0, 8);

      for (const leaf of leavesToSample) {
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
        const vcfOnly = parsed.filter((e) => e.entry.entry_type === 'VcfVariant');
        // Sample middle entry on large chromosomes (where major clinical genes sit) or all entries on small containers
        const chosenEntries =
          session.rootLeaves.length <= 8
            ? parsed
            : vcfOnly.length > 0
              ? [vcfOnly[Math.floor(vcfOnly.length / 2)]]
              : [];
        for (const entryInfo of chosenEntries) {
          allEntryRecords.push({ info: entryInfo, leaf });
        }
      }
    } else if (session.header.is_hierarchical && session.flatEntries.length > 0) {
      for (const entryInfo of session.flatEntries) {
        const matchingLeaf = session.rootLeaves.find(
          (l) =>
            l.chrom_id === entryInfo.chrom_id &&
            entryInfo.entry.start_pos <= l.max_pos &&
            entryInfo.entry.end_pos >= l.min_pos
        );
        allEntryRecords.push({ info: entryInfo, leaf: matchingLeaf });
      }
    } else {
      for (const entryInfo of session.flatEntries) {
        allEntryRecords.push({ info: entryInfo });
      }
    }

    const vcfRecords = allEntryRecords.filter(
      (r) => r.info.entry.entry_type === 'VcfVariant'
    );

    const seenKeys = new Set<string>();
    const items: CatalogVariantItem[] = [];
    for (const rec of vcfRecords) {
      if (items.length >= MAX_CATALOG_SELECTOR_ITEMS) break;
      const { chrom_name, entry } = rec.info;
      const windowRes = await this.queryWindow({
        chrom: chrom_name,
        startPos: entry.start_pos,
        endPos: entry.end_pos,
        viewAssembly: session.containerAssembly,
        sourceMode: session.sourceMode,
        airgapped: session.airgapped,
        datasetUrl: session.datasetUrl,
        opfsFilename: session.opfsFilename,
        signal: options?.signal,
        onLog: options?.onLog,
      });

      const byteRangeHeader = session.airgapped
        ? `OPFS ${session.opfsFilename} [${
            windowRes.slicingPlan
              ? formatByteRangeHeader(windowRes.slicingPlan.byte_ranges)
              : 'none'
          }]`
        : windowRes.slicingPlan
          ? formatByteRangeHeader(windowRes.slicingPlan.byte_ranges)
          : 'none';
      const bytesTransferred =
        session.sourceMode === 'vault'
          ? 0
          : (windowRes.slicingPlan?.total_download_bytes ?? 0);

      const perBlockLimit =
        session.rootLeaves.length > 8 && session.sourceMode === 'public'
          ? 24
          : MAX_CATALOG_SELECTOR_ITEMS;
      const prioritizedVariants =
        perBlockLimit < MAX_CATALOG_SELECTOR_ITEMS
          ? [...windowRes.variants].sort((a, b) => {
              const aRs = a.id.startsWith('rs') ? 1 : 0;
              const bRs = b.id.startsWith('rs') ? 1 : 0;
              return b.score - a.score || bRs - aRs || a.pos - b.pos;
            })
          : windowRes.variants;

      let addedThisBlock = 0;
      for (const variant of prioritizedVariants) {
        if (items.length >= MAX_CATALOG_SELECTOR_ITEMS) break;
        if (addedThisBlock >= perBlockLimit) break;
        const itemKey = `${variant.chrom}:${variant.pos}:${variant.ref}:${variant.alt}`;
        if (seenKeys.has(itemKey)) continue;
        seenKeys.add(itemKey);
        addedThisBlock += 1;

        items.push({
          key: itemKey,
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
   * Intersects a private OPFS Vault file (.vcf / .vcf.gz / 23andMe .txt / .plasmid)
   * against the public ClinVar .plasmid container via HTTP 206 coarse chunk slicing + local WASM.
   * Zero bytes of personal genomic data are ever sent over the network (RFC-0002).
   */
  public async intersectVaultWithPublicClinvar(options: {
    vaultOpfsFilename: string;
    clinvarDatasetUrl?: string;
    clinvarOpfsFilename?: string;
    signal?: AbortSignal;
    onLog?: AuditLogger;
  }): Promise<ClinVarIntersectionReport> {
    const started = performance.now();
    const clinvarDatasetUrl = options.clinvarDatasetUrl ?? DEFAULT_DATASET_URL;
    const clinvarOpfsFilename = options.clinvarOpfsFilename ?? DEFAULT_OPFS_FILENAME;

    // 1. Read personal genome strictly from browser OPFS Vault (0 outbound network bytes)
    const vaultSession = await this.getSession({
      sourceMode: 'vault',
      airgapped: true,
      opfsFilename: options.vaultOpfsFilename,
      signal: options.signal,
      onLog: options.onLog,
    });

    const personalRawVariants: VcfVariantRecord[] =
      vaultSession.vcfDataset?.raw_variants ?? vaultSession.localPlasmidVariants ?? [];
    const personalBuild = vaultSession.header.reference_build || 'GRCh38';

    // 2. Open public ClinVar .plasmid container header + root directory (or OPFS offline cache)
    const clinvarAirgapped = await opfs.hasFile(clinvarOpfsFilename);
    const clinvarSession = await this.getSession({
      sourceMode: 'public',
      airgapped: clinvarAirgapped,
      datasetUrl: clinvarDatasetUrl,
      opfsFilename: clinvarOpfsFilename,
      signal: options.signal,
      onLog: options.onLog,
    });

    if (personalRawVariants.length === 0) {
      return {
        vaultFilename: options.vaultOpfsFilename,
        clinvarDatasetUrl,
        clinvarTotalFileSize: clinvarSession.totalFileSize,
        clinvarBytesFetched: 0,
        clinvarChunksAccessed: [],
        rangeHeadersIssued: [],
        personalBytesSent: 0,
        elapsedMs: Math.round((performance.now() - started) * 10) / 10,
        personal_build: personalBuild,
        clinvar_build: clinvarSession.containerAssembly,
        total_personal_variants: 0,
        carrier_personal_variants: 0,
        lifted_variants_count: 0,
        clinvar_variants_scanned: 0,
        matched_count: 0,
        pathogenic_count: 0,
        likely_pathogenic_count: 0,
        drug_response_count: 0,
        risk_factor_count: 0,
        matches: [],
        chunk_hashes: [],
      };
    }

    let clinvarBytesFetched = 0;
    const rangeHeadersIssued: string[] = [];
    let directoryBytes: Uint8Array;

    if (clinvarSession.header.is_hierarchical) {
      const leafPlan = await decoderClient.planIntersectionLeaves(
        clinvarSession.indexBytes,
        personalRawVariants,
        personalBuild,
        clinvarSession.containerAssembly
      );

      if (leafPlan.leaves.length === 0) {
        return {
          vaultFilename: options.vaultOpfsFilename,
          clinvarDatasetUrl,
          clinvarTotalFileSize: clinvarSession.totalFileSize,
          clinvarBytesFetched: 0,
          clinvarChunksAccessed: [],
          rangeHeadersIssued: [],
          personalBytesSent: 0,
          elapsedMs: Math.round((performance.now() - started) * 10) / 10,
          personal_build: personalBuild,
          clinvar_build: clinvarSession.containerAssembly,
          total_personal_variants: personalRawVariants.length,
          carrier_personal_variants: 0,
          lifted_variants_count: 0,
          clinvar_variants_scanned: 0,
          matched_count: 0,
          pathogenic_count: 0,
          likely_pathogenic_count: 0,
          drug_response_count: 0,
          risk_factor_count: 0,
          matches: [],
          chunk_hashes: [],
        };
      }

      const leafBuffers: Uint8Array[] = [];
      let totalLeafLen = 0;

      for (const leaf of leafPlan.leaves) {
        const cacheKey = `${leaf.leaf_offset}:${leaf.leaf_length}`;
        let leafBuf = clinvarSession.leafCache.get(cacheKey);
        if (!leafBuf) {
          const leafRes = await this.readByteRange({
            datasetUrl: clinvarSession.datasetUrl,
            opfsFilename: clinvarSession.opfsFilename,
            start: leaf.leaf_offset,
            end: leaf.leaf_offset + leaf.leaf_length - 1,
            airgapped: clinvarSession.airgapped,
            signal: options.signal,
            label: `Leaf Dir (${leaf.chrom_name})`,
            onLog: options.onLog,
          });
          leafBuf = leafRes.bytes;
          clinvarSession.leafCache.set(cacheKey, leafBuf);
          clinvarBytesFetched += leafBuf.byteLength;
          rangeHeadersIssued.push(leafRes.rangeHeader);
        }
        leafBuffers.push(leafBuf);
        totalLeafLen += leafBuf.byteLength;
      }

      directoryBytes = new Uint8Array(totalLeafLen);
      let off = 0;
      for (const b of leafBuffers) {
        directoryBytes.set(b, off);
        off += b.byteLength;
      }
    } else {
      directoryBytes = clinvarSession.indexBytes;
    }

    const slicingPlan = await decoderClient.planIntersectionChunks(
      directoryBytes,
      personalRawVariants,
      personalBuild,
      clinvarSession.containerAssembly,
      clinvarSession.header.payload_offset,
      clinvarSession.header.chunk_size
    );

    if (slicingPlan.chunk_indices.length === 0 || slicingPlan.entries.length === 0) {
      return {
        vaultFilename: options.vaultOpfsFilename,
        clinvarDatasetUrl,
        clinvarTotalFileSize: clinvarSession.totalFileSize,
        clinvarBytesFetched,
        clinvarChunksAccessed: [],
        rangeHeadersIssued,
        personalBytesSent: 0,
        elapsedMs: Math.round((performance.now() - started) * 10) / 10,
        personal_build: personalBuild,
        clinvar_build: clinvarSession.containerAssembly,
        total_personal_variants: personalRawVariants.length,
        carrier_personal_variants: 0,
        lifted_variants_count: 0,
        clinvar_variants_scanned: 0,
        matched_count: 0,
        pathogenic_count: 0,
        likely_pathogenic_count: 0,
        drug_response_count: 0,
        risk_factor_count: 0,
        matches: [],
        chunk_hashes: [],
      };
    }

    const chunkFetch = await this.ensureChunksCached(
      clinvarSession,
      slicingPlan,
      options.signal,
      options.onLog
    );
    clinvarBytesFetched += chunkFetch.bytesFetched;
    rangeHeadersIssued.push(...chunkFetch.rangeHeaders);

    const wasmRes = await decoderClient.intersectPersonalWithClinvar(
      personalRawVariants,
      personalBuild,
      slicingPlan.entries,
      chunkFetch.chunksConcat,
      slicingPlan.chunk_indices,
      clinvarSession.header.chunk_size,
      clinvarSession.containerAssembly
    );

    options.onLog?.(
      `WASM ClinVar intersection matched ${wasmRes.matched_count} clinical variant(s) across ${slicingPlan.chunk_indices.length} Zstd chunk(s) (0 personal bytes sent)`,
      'worker'
    );

    return {
      vaultFilename: options.vaultOpfsFilename,
      clinvarDatasetUrl,
      clinvarTotalFileSize: clinvarSession.totalFileSize,
      clinvarBytesFetched,
      clinvarChunksAccessed: slicingPlan.chunk_indices,
      rangeHeadersIssued,
      personalBytesSent: 0,
      elapsedMs: Math.round((performance.now() - started) * 10) / 10,
      ...wasmRes,
    };
  }

  /**
   * Verifies full SHA-256 BEP 52 Merkle Root (or raw OPFS VCF SHA-256 digest) in WebAssembly.
   */
  public async verifyContainerMerkle(options?: SessionLookupOptions): Promise<{
    verification: WasmMerkleVerification;
    elapsedMs: number;
    session: ContainerSession;
  }> {
    const started = performance.now();
    const session = await this.getSession(options);

    if (session.sourceKind === 'local-vcf') {
      const rawBuf = await opfs.readFile(session.opfsFilename);
      const bytes = new Uint8Array(rawBuf);
      const { verified, sha256Hex } = await decoderClient.verifyChunkHash(
        bytes,
        session.header.root_hash_hex
      );
      return {
        verification: {
          verified,
          expected_root_hex: session.header.root_hash_hex,
          calculated_root_hex: sha256Hex,
          total_chunks: 1,
          verified_bytes: bytes.byteLength,
          chunk_hashes: [sha256Hex],
        },
        elapsedMs: Math.round((performance.now() - started) * 10) / 10,
        session,
      };
    }

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

  /**
   * Injects a cryptographically SHA-256 / Merkle-verified 16KB chunk obtained via WebRTC P2P
   * or HTTP 206 Origin fallback directly into any open public container session cache.
   */
  public injectVerifiedSwarmChunk(
    datasetUrl: string,
    chunkIndex: number,
    chunkBytes: Uint8Array
  ): void {
    const copy = new Uint8Array(chunkBytes);
    for (const session of this.sessions.values()) {
      if (
        session.sourceMode === 'public' &&
        (session.datasetUrl === datasetUrl || datasetUrl === DEFAULT_DATASET_URL)
      ) {
        session.chunkCache.set(chunkIndex, copy);
      }
    }
  }

  /**
   * Loads and cryptographically Merkle-verifies the full public .plasmid payload
   * so this browser peer can serve authentic 16KB leaf chunks + BEP 52 Merkle proofs as a WebRTC Seeder.
   * Never reads from Private OPFS Vault paths (RFC-0002 Air-Gap enforced).
   */
  public async loadPublicPayloadForSeeding(options?: {
    datasetUrl?: string;
    opfsFilename?: string;
    signal?: AbortSignal;
    onLog?: AuditLogger;
  }): Promise<{
    session: ContainerSession;
    payloadBytes: Uint8Array;
    verification: WasmMerkleVerification;
  }> {
    const datasetUrl = options?.datasetUrl ?? DEFAULT_DATASET_URL;
    const opfsFilename = options?.opfsFilename ?? DEFAULT_OPFS_FILENAME;
    if (opfsFilename.startsWith(`${VAULT_DIR_NAME}/`)) {
      throw new Error(
        'RFC-0002 Air-Gap violation: private OPFS Vault files can never be seeded over WebRTC P2P.'
      );
    }

    const airgapped = await opfs.hasFile(opfsFilename);
    const session = await this.getSession({
      sourceMode: 'public',
      airgapped,
      datasetUrl,
      opfsFilename,
      signal: options?.signal,
      onLog: options?.onLog,
    });

    const { header } = session;
    const payloadStart = header.payload_offset;
    const payloadEnd = payloadStart + header.total_payload_bytes - 1;

    const payloadRes = await this.readByteRange({
      datasetUrl,
      opfsFilename,
      start: payloadStart,
      end: payloadEnd,
      airgapped: session.airgapped,
      signal: options?.signal,
      label: `Seeder Payload (${header.total_chunks} chunks)`,
      onLog: options?.onLog,
    });

    const verification = await decoderClient.verifyMerkleTree(
      payloadRes.bytes,
      header.chunk_size,
      header.root_hash_hex
    );

    if (!verification.verified) {
      throw new Error(
        `Cannot seed container: Merkle root verification failed (expected 0x${verification.expected_root_hex.slice(0, 16)}…, computed 0x${verification.calculated_root_hex.slice(0, 16)}…)`
      );
    }

    for (let i = 0; i < header.total_chunks; i++) {
      const slice = payloadRes.bytes.slice(
        i * header.chunk_size,
        (i + 1) * header.chunk_size
      );
      session.chunkCache.set(i, slice);
    }

    return {
      session,
      payloadBytes: payloadRes.bytes,
      verification,
    };
  }

  /**
   * Fetches clean 16KB chunk(s) directly from the HTTPS Origin via HTTP 206 Range requests
   * when a Byzantine P2P peer sends tampered chunk bytes and is banned.
   */
  public async fetchOriginChunksHttp206(options: {
    datasetUrl?: string;
    header: WasmHeaderInfo;
    chunkIndices: number[];
    signal?: AbortSignal;
    onLog?: AuditLogger;
  }): Promise<{
    chunks: Map<number, { bytes: Uint8Array; sha256Hex: string }>;
    bytesFetched: number;
    rangeHeaders: string[];
    httpStatuses: number[];
  }> {
    const datasetUrl = options.datasetUrl ?? DEFAULT_DATASET_URL;
    const { header } = options;
    const chunkSize = header.chunk_size;
    const payloadOffset = header.payload_offset;

    const sorted = [...new Set(options.chunkIndices)].sort((a, b) => a - b);
    const runs: { firstIdx: number; count: number }[] = [];
    for (const idx of sorted) {
      if (idx < 0 || idx >= header.total_chunks) {
        throw new Error(`Origin fallback chunk #${idx} out of bounds (0..${header.total_chunks - 1})`);
      }
      const last = runs[runs.length - 1];
      if (last && last.firstIdx + last.count === idx) {
        last.count += 1;
      } else {
        runs.push({ firstIdx: idx, count: 1 });
      }
    }

    const chunks = new Map<number, { bytes: Uint8Array; sha256Hex: string }>();
    let bytesFetched = 0;
    const rangeHeaders: string[] = [];
    const httpStatuses: number[] = [];

    for (const run of runs) {
      const start = payloadOffset + run.firstIdx * chunkSize;
      const end = start + run.count * chunkSize - 1;
      const rangeHeader = `bytes=${start}-${end}`;
      const expectedLen = run.count * chunkSize;

      const res = await fetch(datasetUrl, {
        headers: { Range: rangeHeader },
        signal: options.signal,
      });

      if (!res.ok && res.status !== 206) {
        throw new Error(
          `Origin fallback HTTP ${res.status} for ${datasetUrl} [${rangeHeader}]`
        );
      }

      httpStatuses.push(res.status);
      rangeHeaders.push(rangeHeader);

      const rawBuf = await res.arrayBuffer();
      const rawBytes = new Uint8Array(rawBuf);
      const runBytes =
        res.status === 206
          ? rawBytes
          : rawBytes.slice(start, Math.min(rawBytes.byteLength, start + expectedLen));

      if (runBytes.byteLength !== expectedLen) {
        throw new Error(
          `Origin fallback truncated response: expected ${expectedLen} B, received ${runBytes.byteLength} B`
        );
      }

      bytesFetched += runBytes.byteLength;
      options.onLog?.(
        `HTTP ${res.status} Origin Fallback [${rangeHeader}] (${runBytes.byteLength.toLocaleString()} B)`,
        'network'
      );

      for (let i = 0; i < run.count; i++) {
        const chunkIdx = run.firstIdx + i;
        const slice = runBytes.slice(i * chunkSize, (i + 1) * chunkSize);
        const { sha256Hex } = await decoderClient.verifyChunkHash(slice);
        chunks.set(chunkIdx, { bytes: slice, sha256Hex });
        this.injectVerifiedSwarmChunk(datasetUrl, chunkIdx, slice);
      }
    }

    return { chunks, bytesFetched, rangeHeaders, httpStatuses };
  }
}

export const plasmidContainerClient = new PlasmidContainerClient();
