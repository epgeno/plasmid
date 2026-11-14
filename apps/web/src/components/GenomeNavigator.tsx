import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldCheck,
  Download,
  Activity,
  RefreshCw,
  AlertTriangle,
  Database,
} from 'lucide-react';
import { opfs } from '../services/opfs';
import { decoderClient, ParsedVariant, DensityBin } from '../services/decoderClient';
import {
  plasmidContainerClient,
  DEFAULT_DATASET_URL,
  DEFAULT_OPFS_FILENAME,
  type AuditLogType,
  type WindowQueryResult,
} from '../services/plasmidContainerClient';
import type {
  AnnotationRecord,
  CatalogVariantItem,
  ChromosomeOverview,
  GenomeAssembly,
  PlasmidIndexEntry,
  PyramidIndex,
  WasmChunkHashInfo,
} from '../types/plasmid';

const ORDERED_CHROMOSOMES = [
  'chr1', 'chr2', 'chr3', 'chr4', 'chr5', 'chr6',
  'chr7', 'chr8', 'chr9', 'chr10', 'chr11', 'chr12',
  'chr13', 'chr14', 'chr15', 'chr16', 'chr17', 'chr18',
  'chr19', 'chr20', 'chr21', 'chr22', 'chrX', 'chrY',
];

export interface GenomeNavigatorProps {
  catalogItems?: CatalogVariantItem[];
  selectedCatalogKey?: string | null;
  onSelectCatalogKey?: (key: string) => void;
}

interface IndexedHotspotChip {
  key: string;
  label: string;
  chrom: string;
  pos: number;
  windowStart: number;
  windowEnd: number;
  clinvar?: string;
}

export const GenomeNavigator: React.FC<GenomeNavigatorProps> = ({
  catalogItems = [],
  selectedCatalogKey,
  onSelectCatalogKey,
}) => {
  const [assembly, setAssembly] = useState<GenomeAssembly>('GRCh38');
  const [selectedChrom, setSelectedChrom] = useState<string>('chr7');
  const [windowStart, setWindowStart] = useState<number>(140750000);
  const [windowEnd, setWindowEnd] = useState<number>(140756000);

  const [isAirgapped, setIsAirgapped] = useState<boolean>(false);
  const [isOpfsCached, setIsOpfsCached] = useState<boolean>(false);
  const [cachingProgress, setCachingProgress] = useState<number | null>(null);

  const [assemblyPyramid, setAssemblyPyramid] = useState<PyramidIndex | null>(null);
  const [containerPyramid, setContainerPyramid] = useState<PyramidIndex | null>(null);

  const [variants, setVariants] = useState<ParsedVariant[]>([]);
  const [annotations, setAnnotations] = useState<AnnotationRecord[]>([]);
  const [referenceSequence, setReferenceSequence] = useState<string | null>(null);
  const [matchedEntries, setMatchedEntries] = useState<PlasmidIndexEntry[]>([]);
  const [chunkHashes, setChunkHashes] = useState<WasmChunkHashInfo[]>([]);
  const [lastQueryResult, setLastQueryResult] = useState<WindowQueryResult | null>(null);
  const [densityBins, setDensityBins] = useState<DensityBin[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedVariantPos, setSelectedVariantPos] = useState<number | null>(null);
  const [hoveredVariant, setHoveredVariant] = useState<ParsedVariant | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number; bp: number } | null>(null);

  const [logs, setLogs] = useState<
    { id: string; timestamp: string; message: string; type: AuditLogType }[]
  >([]);

  const trackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overviewBarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const karyotypeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addLog = useCallback((message: string, type: AuditLogType) => {
    setLogs((prev) => [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toLocaleTimeString(),
        message,
        type,
      },
      ...prev.slice(0, 29),
    ]);
  }, []);

  // Check OPFS cache state on mount
  useEffect(() => {
    opfs.hasFile(DEFAULT_OPFS_FILENAME).then((cached: boolean) => {
      setIsOpfsCached(cached);
      if (cached) {
        setIsAirgapped(true);
        addLog(
          `Found ${DEFAULT_OPFS_FILENAME} in OPFS. Engaged offline Airgap slicing.`,
          'opfs'
        );
      }
    });
  }, [addLog]);

  // Load authoritative chromosome geometry from Rust WASM for active assembly
  useEffect(() => {
    let cancelled = false;
    plasmidContainerClient
      .getAssemblyPyramid(assembly)
      .then((pyr) => {
        if (!cancelled) setAssemblyPyramid(pyr);
      })
      .catch((err) => {
        if (!cancelled) {
          addLog(`WASM assembly geometry error: ${err.message}`, 'worker');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [assembly, addLog]);

  // Sync window when external catalog item is chosen in parent header
  useEffect(() => {
    if (!selectedCatalogKey || catalogItems.length === 0) return;
    const found = catalogItems.find((item) => item.key === selectedCatalogKey);
    if (!found) return;

    const targetChrom = found.variant.chrom;
    const applyJump = async () => {
      let targetPos = found.variant.pos;
      if (assembly === 'GRCh37') {
        try {
          const lifted = await decoderClient.liftoverCoordinate(
            'hg38_to_hg19',
            targetChrom,
            found.variant.pos,
            found.variant.ref
          );
          targetPos = lifted.lifted_pos;
        } catch {
          // Keep container coordinate if unmapped
        }
      }
      setSelectedChrom(targetChrom);
      setWindowStart(Math.max(1, targetPos - 3000));
      setWindowEnd(targetPos + 3000);
      setSelectedVariantPos(targetPos);
    };
    void applyJump();
  }, [selectedCatalogKey, catalogItems, assembly]);

  // Active pyramid data: merge container pyramid scores when assemblies match, otherwise use WASM assembly lengths
  const activeChromosomesMap = useMemo(() => {
    const map = new Map<string, ChromosomeOverview>();
    const baseSource =
      containerPyramid && containerPyramid.build.toUpperCase().includes(assembly === 'GRCh37' ? '37' : '38')
        ? containerPyramid
        : assemblyPyramid;

    if (baseSource) {
      for (const c of baseSource.chromosomes) {
        // Carry over variant counts from container pyramid for chromosome-level indicator accuracy
        const containerChr = containerPyramid?.chromosomes.find(
          (cc) => cc.chrom_name === c.chrom_name
        );
        map.set(c.chrom_name, {
          ...c,
          total_variants: containerChr?.total_variants ?? c.total_variants,
          pathogenic_count: containerChr?.pathogenic_count ?? c.pathogenic_count,
          bins:
            baseSource === containerPyramid
              ? c.bins
              : c.bins,
          max_score:
            baseSource === containerPyramid
              ? c.max_score
              : c.max_score,
        });
      }
    }
    return map;
  }, [assembly, assemblyPyramid, containerPyramid]);

  const currentChromOverview = useMemo(() => {
    return activeChromosomesMap.get(selectedChrom) ?? null;
  }, [activeChromosomesMap, selectedChrom]);

  // Derive Quick Jump chips strictly from real indexed .plasmid entries / root leaves (zero hardcoded loci)
  const indexedChips = useMemo<IndexedHotspotChip[]>(() => {
    if (catalogItems.length > 0) {
      return catalogItems.map((item) => ({
        key: item.key,
        label: item.variant.gene
          ? `${item.variant.gene} (${item.variant.id})`
          : `${item.variant.chrom}:${item.variant.pos.toLocaleString()}`,
        chrom: item.variant.chrom,
        pos: item.variant.pos,
        windowStart: Math.max(1, item.variant.pos - 3000),
        windowEnd: item.variant.pos + 3000,
        clinvar: item.variant.clinvar,
      }));
    }

    const leaves = lastQueryResult?.session.rootLeaves ?? [];
    return leaves.map((leaf) => ({
      key: `${leaf.chrom_name}:${leaf.max_pos}`,
      label: `${leaf.chrom_name} leaf (${leaf.entry_count} entries)`,
      chrom: leaf.chrom_name,
      pos: leaf.max_pos,
      windowStart: Math.max(1, leaf.max_pos - 3000),
      windowEnd: leaf.max_pos + 3000,
    }));
  }, [catalogItems, lastQueryResult]);

  // Switch assembly using Rust WASM LiftoverEngine
  const handleAssemblySwitch = async (newAssembly: GenomeAssembly) => {
    if (newAssembly === assembly) return;

    const span = Math.max(1000, windowEnd - windowStart);
    const midpoint = Math.round((windowStart + windowEnd) / 2);
    const direction =
      assembly === 'GRCh38' && newAssembly === 'GRCh37'
        ? 'hg38_to_hg19'
        : 'hg19_to_hg38';

    try {
      const lifted = await decoderClient.liftoverCoordinate(
        direction,
        selectedChrom,
        midpoint,
        'N'
      );
      const newStart = Math.max(1, Math.round(lifted.lifted_pos - span / 2));
      const newEnd = newStart + span;
      setAssembly(newAssembly);
      setWindowStart(newStart);
      setWindowEnd(newEnd);
      addLog(
        `WASM Liftover translated ${selectedChrom}:${midpoint.toLocaleString()} (${assembly}) -> ${lifted.lifted_pos.toLocaleString()} (${newAssembly})`,
        'worker'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAssembly(newAssembly);
      addLog(
        `Switched assembly to ${newAssembly} (midpoint ${selectedChrom}:${midpoint.toLocaleString()} outside curated Liftover chain: ${msg})`,
        'worker'
      );
    }
  };

  const handleJumpToChip = async (chip: IndexedHotspotChip) => {
    let targetPos = chip.pos;
    if (assembly === 'GRCh37') {
      try {
        const lifted = await decoderClient.liftoverCoordinate(
          'hg38_to_hg19',
          chip.chrom,
          chip.pos,
          'N'
        );
        targetPos = lifted.lifted_pos;
      } catch {
        // Leave targetPos at container coordinate if unmapped
      }
    }
    setSelectedChrom(chip.chrom);
    setWindowStart(Math.max(1, targetPos - 3000));
    setWindowEnd(targetPos + 3000);
    setSelectedVariantPos(targetPos);
    onSelectCatalogKey?.(chip.key);
    addLog(`Jumped to indexed locus ${chip.label} on ${chip.chrom}`, 'worker');
  };

  const handleCacheToOpfs = async () => {
    try {
      setCachingProgress(5);
      addLog(`Downloading ${DEFAULT_DATASET_URL} into browser OPFS sandbox...`, 'opfs');

      await opfs.cacheRemoteDataset(
        DEFAULT_OPFS_FILENAME,
        DEFAULT_DATASET_URL,
        (received, total) => {
          if (total > 0) {
            setCachingProgress(Math.round((received / total) * 100));
          }
        }
      );

      plasmidContainerClient.clearCache();
      setIsOpfsCached(true);
      setIsAirgapped(true);
      setCachingProgress(null);
      setLoadError(null);
      addLog(
        `${DEFAULT_OPFS_FILENAME} cached in OPFS. Zero-network Airgap slicing engaged.`,
        'opfs'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCachingProgress(null);
      setLoadError(`OPFS cache failed: ${msg}`);
      addLog(`OPFS cache error: ${msg}`, 'opfs');
    }
  };

  // Query exact .plasmid byte range via 128B Header -> Root/Leaf Directory -> Chunk Range
  const fetchLocusData = useCallback(
    async (chrom: string, start: number, end: number, viewAsm: GenomeAssembly) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setLoadError(null);
      const span = end - start;

      try {
        const res = await plasmidContainerClient.queryWindow({
          chrom,
          startPos: start,
          endPos: end,
          viewAssembly: viewAsm,
          airgapped: isAirgapped,
          signal: controller.signal,
          onLog: addLog,
        });

        setContainerPyramid(res.session.pyramid);
        setLastQueryResult(res);
        setVariants(res.variants);
        setAnnotations(res.annotations);
        setReferenceSequence(res.referenceSequence);
        setMatchedEntries(res.matchedEntries);
        setChunkHashes(res.chunkHashes);

        if (res.variants.length > 0) {
          setSelectedVariantPos((prev) =>
            res.variants.some((v) => v.pos === prev) ? prev : res.variants[0].pos
          );
        } else {
          setSelectedVariantPos(null);
        }

        if (span > 20000 && res.variants.length > 0) {
          const bins = await decoderClient.computeDensityBins(res.variants, start, end, 60);
          setDensityBins(bins);
        } else {
          setDensityBins([]);
        }

        setIsLoading(false);
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          (err.name === 'AbortError' || err.name === 'AbortEvent')
        ) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setIsLoading(false);
        setLoadError(message);
        setVariants([]);
        setAnnotations([]);
        setReferenceSequence(null);
        setMatchedEntries([]);
        setChunkHashes([]);
        setDensityBins([]);
        addLog(`Slice error: ${message}`, isAirgapped ? 'opfs' : 'network');
      }
    },
    [isAirgapped, addLog]
  );

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      void fetchLocusData(selectedChrom, windowStart, windowEnd, assembly);
    }, 100);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [selectedChrom, windowStart, windowEnd, assembly, fetchLocusData]);

  // Render Level 0 Karyotype Canvas from real .plasmid PyramidIndex
  useEffect(() => {
    const canvas = karyotypeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const maxChromBp = Math.max(
      1,
      ...Array.from(activeChromosomesMap.values()).map((c) => c.length),
      248956422
    );
    const colWidth = (width - 16) / ORDERED_CHROMOSOMES.length;

    ORDERED_CHROMOSOMES.forEach((chr, idx) => {
      const overview = activeChromosomesMap.get(chr);
      const chrLen = overview?.length ?? 100_000_000;
      const barH = Math.max(12, (chrLen / maxChromBp) * (height - 32));
      const x = 8 + idx * colWidth + (colWidth - 8) / 2;
      const y = height - 20 - barH;
      const isSelected = chr === selectedChrom;

      // Capsule body
      ctx.beginPath();
      ctx.roundRect(x, y, 8, barH, 4);
      ctx.fillStyle = isSelected ? '#2563eb' : '#e2e8f0';
      ctx.fill();

      // Real 1Mb pyramid density bin ticks inside capsule
      if (overview && overview.max_score > 0) {
        overview.bins.forEach((binScore, binIdx) => {
          if (binScore <= 0) return;
          const relY = y + ((binIdx * 1_000_000) / Math.max(1, chrLen)) * barH;
          ctx.fillStyle = isSelected
            ? '#ffffff'
            : binScore >= 10
              ? '#dc2626'
              : '#d97706';
          ctx.fillRect(x + 1, Math.min(y + barH - 2, relY), 6, 2);
        });
      }

      // Indicator dot strictly from real .plasmid PyramidIndex counts
      if (overview && overview.total_variants > 0) {
        ctx.beginPath();
        ctx.arc(x + 4, y - 5, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = overview.pathogenic_count > 0 ? '#dc2626' : '#f59e0b';
        ctx.fill();
      }

      ctx.fillStyle = isSelected ? '#2563eb' : '#64748b';
      ctx.font = isSelected
        ? '600 10px Inter, Pretendard, sans-serif'
        : '400 9px Inter, Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(chr.replace('chr', ''), x + 4, height - 6);
    });
  }, [selectedChrom, activeChromosomesMap]);

  // Render Level 1 Chromosome Arm Geometry & 1Mb Pyramid Density Bar (no synthetic cytobands)
  useEffect(() => {
    const canvas = overviewBarCanvasRef.current;
    if (!canvas || !currentChromOverview) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const padX = 24;
    const drawW = Math.max(40, width - padX * 2);
    const barH = 24;
    const barY = (height - barH) / 2;
    const chrLen = Math.max(1, currentChromOverview.length);
    const cenX = padX + (currentChromOverview.centromere / chrLen) * drawW;

    // Draw p-arm and q-arm capsules meeting at real centromere coordinate
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.25;

    const pArmW = Math.max(4, cenX - padX - 2);
    const qArmW = Math.max(4, padX + drawW - (cenX + 2));

    ctx.beginPath();
    ctx.roundRect(padX, barY, pArmW, barH, [12, 4, 4, 12]);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(cenX + 2, barY, qArmW, barH, [4, 12, 12, 4]);
    ctx.fill();
    ctx.stroke();

    // Centromere marker
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(cenX - 2, barY + 4, 4, barH - 8);

    // Overlay real 1Mb PyramidIndex bins from .plasmid metadata
    const binSize = containerPyramid?.bin_size ?? 1_000_000;
    const maxScore = Math.max(1, currentChromOverview.max_score);
    currentChromOverview.bins.forEach((score, binIdx) => {
      if (score <= 0) return;
      const binStart = binIdx * binSize;
      const binEnd = Math.min(chrLen, (binIdx + 1) * binSize);
      const bx = padX + (binStart / chrLen) * drawW;
      const bw = Math.max(3, ((binEnd - binStart) / chrLen) * drawW);
      const intensity = Math.min(1, 0.35 + (score / maxScore) * 0.65);
      ctx.fillStyle =
        score >= 10
          ? `rgba(220, 38, 38, ${intensity})`
          : `rgba(217, 119, 6, ${intensity})`;
      ctx.fillRect(bx, barY + 2, bw, barH - 4);
    });
    ctx.restore();

    // Arm labels
    ctx.fillStyle = '#64748b';
    ctx.font = '500 9px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('p-arm', padX + 6, barY + 15);
    ctx.textAlign = 'right';
    ctx.fillText('q-arm', padX + drawW - 6, barY + 15);

    // Viewfinder Lens
    const vfX = padX + (windowStart / chrLen) * drawW;
    const vfW = Math.max(6, ((windowEnd - windowStart) / chrLen) * drawW);

    ctx.fillStyle = 'rgba(37, 99, 235, 0.16)';
    ctx.fillRect(vfX, barY - 4, vfW, barH + 8);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(vfX, barY - 4, vfW, barH + 8);

    // Pins strictly for real decoded variants in current window
    variants.forEach((v) => {
      const lx = padX + (v.pos / chrLen) * drawW;
      ctx.beginPath();
      ctx.arc(lx, barY - 7, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = v.score >= 10 ? '#dc2626' : '#f59e0b';
      ctx.fill();
    });
  }, [
    currentChromOverview,
    containerPyramid,
    windowStart,
    windowEnd,
    variants,
  ]);

  // Render Level 2/3 High-Resolution Track Canvas (Ruler + Real Indexed Blocks/FASTA + Decoded Variants)
  useEffect(() => {
    const canvas = trackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const padLeft = 40;
    const padRight = 40;
    const drawW = Math.max(40, width - padLeft - padRight);
    const span = Math.max(1, windowEnd - windowStart);

    // 1. Genomic Coordinate Ruler
    const rulerY = 32;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, rulerY);
    ctx.lineTo(width - padRight, rulerY);
    ctx.stroke();

    const tickCount = 6;
    for (let i = 0; i <= tickCount; i++) {
      const tickBp = Math.round(windowStart + (i / tickCount) * span);
      const tx = padLeft + (i / tickCount) * drawW;

      ctx.beginPath();
      ctx.moveTo(tx, rulerY - 6);
      ctx.lineTo(tx, rulerY);
      ctx.strokeStyle = '#94a3b8';
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '500 11px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      const label =
        span < 50_000
          ? `${tickBp.toLocaleString()} bp`
          : `${(tickBp / 1_000_000).toFixed(3)} Mb`;
      ctx.fillText(label, tx, rulerY - 10);
    }

    // 2. Real .plasmid Indexed Blocks & Reference Sequence Track
    const blockTrackY = 86;
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 12px Inter, Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `CONTAINER INDEXED BLOCKS & FASTA (${matchedEntries.length} matched in slice)`,
      padLeft,
      blockTrackY - 16
    );

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, blockTrackY);
    ctx.lineTo(width - padRight, blockTrackY);
    ctx.stroke();

    if (matchedEntries.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '400 12px Inter, Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        'No .plasmid data blocks overlap this coordinate interval.',
        width / 2,
        blockTrackY + 4
      );
    } else {
      matchedEntries.forEach((entry, i) => {
        const clampedStart = Math.max(windowStart, entry.start_pos);
        const clampedEnd = Math.min(windowEnd, Math.max(entry.start_pos, entry.end_pos));
        const bx = padLeft + ((clampedStart - windowStart) / span) * drawW;
        const bw = Math.max(12, ((clampedEnd - clampedStart + 1) / span) * drawW);
        const rowOffset = (i % 2) * 4;

        let blockColor = '#2563eb';
        if (entry.entry_type === 'ReferenceFasta') blockColor = '#0d9488';
        if (entry.entry_type === 'ClinVarAnnotation' || entry.entry_type === 'WikiMarkdown') {
          blockColor = '#7c3aed';
        }

        ctx.fillStyle = blockColor;
        ctx.beginPath();
        ctx.roundRect(bx - bw / 2 + bw / 2, blockTrackY - 9 + rowOffset, bw, 18, 4);
        ctx.fill();

        ctx.fillStyle = '#475569';
        ctx.font = '500 10px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          `${entry.entry_type} #${entry.chunk_start} (${entry.payload_bytes}B)`,
          Math.min(width - padRight - 40, Math.max(padLeft + 40, bx + bw / 2)),
          blockTrackY + 22
        );
      });
    }

    if (referenceSequence) {
      const preview =
        referenceSequence.length > 64
          ? `${referenceSequence.slice(0, 64)}… (${referenceSequence.length} bp)`
          : `${referenceSequence} (${referenceSequence.length} bp)`;
      ctx.fillStyle = '#0f766e';
      ctx.font = '600 11px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`FASTA: ${preview}`, padLeft, blockTrackY + 36);
    }

    // 3. Decoded Variants Track
    const varY = 172;
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 12px Inter, Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `WASM DECODED VARIANTS (${variants.length} decoded in window)`,
      padLeft,
      varY - 22
    );

    if (loadError) {
      ctx.fillStyle = '#dc2626';
      ctx.font = '500 12px Inter, Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Slice load failed: ${loadError}`, width / 2, varY + 14);
    } else if (span <= 20000) {
      if (variants.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '400 13px Inter, Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          lastQueryResult?.unmappedLiftoverReason
            ? 'Window outside curated Liftover chain — switch assembly or jump to an indexed locus.'
            : 'No variants observed in this genomic window.',
          width / 2,
          varY + 16
        );
      } else {
        variants.forEach((v) => {
          const vx = padLeft + ((v.pos - windowStart) / span) * drawW;
          const isSelected = selectedVariantPos === v.pos;

          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(vx, rulerY);
          ctx.lineTo(vx, varY + 28);
          ctx.stroke();
          ctx.setLineDash([]);

          let pinColor = '#3b82f6';
          if (v.score >= 10) {
            pinColor = '#dc2626';
          } else if (v.score >= 5) {
            pinColor = '#f59e0b';
          }

          ctx.beginPath();
          ctx.arc(vx, varY, isSelected ? 15 : 12, 0, Math.PI * 2);
          ctx.fillStyle =
            pinColor === '#dc2626'
              ? 'rgba(220, 38, 38, 0.16)'
              : 'rgba(245, 158, 11, 0.16)';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(vx, varY, 7, 0, Math.PI * 2);
          ctx.fillStyle = pinColor;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#0f172a';
          ctx.font = '600 11px ui-monospace, SFMono-Regular, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${v.ref}>${v.alt}`, vx, varY - 16);

          ctx.fillStyle = pinColor;
          ctx.font = '600 10px Inter, Pretendard, sans-serif';
          ctx.fillText(v.clinvar || v.id, vx, varY + 24);
        });
      }
    } else if (densityBins.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '400 13px Inter, Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No variants observed in this genomic window.', width / 2, varY + 16);
    } else {
      const maxCount = Math.max(1, ...densityBins.map((b) => b.count));
      const binW = drawW / Math.max(1, densityBins.length);

      densityBins.forEach((bin, idx) => {
        if (bin.count === 0) return;
        const bx = padLeft + idx * binW;
        const bH = Math.max(4, (bin.count / maxCount) * 50);
        ctx.fillStyle = bin.score >= 10 ? '#ef4444' : '#3b82f6';
        ctx.fillRect(bx, varY + 40 - bH, Math.max(2, binW - 1), bH);
      });
    }
  }, [
    windowStart,
    windowEnd,
    variants,
    matchedEntries,
    referenceSequence,
    densityBins,
    loadError,
    selectedVariantPos,
    lastQueryResult,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padLeft = 40;
    const padRight = 40;
    const drawW = rect.width - padLeft - padRight;
    const span = Math.max(1, windowEnd - windowStart);

    if (x >= padLeft && x <= rect.width - padRight) {
      const bp = Math.round(windowStart + ((x - padLeft) / drawW) * span);
      setHoverPos({ x, y, bp });

      const hit = variants.find((v) => {
        const vx = padLeft + ((v.pos - windowStart) / span) * drawW;
        return Math.abs(x - vx) < 14;
      });
      setHoveredVariant(hit || null);
    } else {
      setHoverPos(null);
      setHoveredVariant(null);
    }
  };

  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    if (hoverPos) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hoverPos.x, 20);
      ctx.lineTo(hoverPos.x, rect.height - 20);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(hoverPos.x - 52, 6, 104, 20, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '500 10px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${hoverPos.bp.toLocaleString()} bp`, hoverPos.x, 20);

      if (hoveredVariant) {
        const label = `${hoveredVariant.gene ? `${hoveredVariant.gene} • ` : ''}${hoveredVariant.id} (${hoveredVariant.ref}>${hoveredVariant.alt})`;
        const boxW = Math.max(130, label.length * 6.5);
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.roundRect(hoverPos.x - boxW / 2, 212, boxW, 22, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 10px Inter, Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, hoverPos.x, 227);
      }
    }
  }, [hoverPos, hoveredVariant]);

  const handleZoom = (factor: number) => {
    const maxLen = currentChromOverview?.length || 250_000_000;
    const span = Math.max(100, windowEnd - windowStart);
    const center = Math.round((windowStart + windowEnd) / 2);
    const newSpan = Math.max(200, Math.min(maxLen, Math.round(span * factor)));
    const newStart = Math.max(1, Math.round(center - newSpan / 2));
    const newEnd = Math.min(maxLen, newStart + newSpan);
    setWindowStart(newStart);
    setWindowEnd(newEnd);
  };

  const handlePan = (direction: 'left' | 'right') => {
    const maxLen = currentChromOverview?.length || 250_000_000;
    const span = Math.max(200, windowEnd - windowStart);
    const step = Math.max(50, Math.round(span * 0.25));
    if (direction === 'left') {
      const newStart = Math.max(1, windowStart - step);
      setWindowStart(newStart);
      setWindowEnd(Math.min(maxLen, newStart + span));
    } else {
      const newEnd = Math.min(maxLen, windowEnd + step);
      setWindowEnd(newEnd);
      setWindowStart(Math.max(1, newEnd - span));
    }
  };

  const inspectedVariant = useMemo(() => {
    if (hoveredVariant) return hoveredVariant;
    if (selectedVariantPos !== null) {
      const found = variants.find((v) => v.pos === selectedVariantPos);
      if (found) return found;
    }
    return variants[0] ?? null;
  }, [hoveredVariant, selectedVariantPos, variants]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '20px 24px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Multi-scale Whole-Genome Navigator
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
              }}
            >
              Level {windowEnd - windowStart <= 20000 ? '3 (Base/Variant)' : '2 (Density)'}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            128B header + 2-stage hierarchical leaf slicing with Rust/WASM decoding &amp; SHA-256 verification.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: '#f1f5f9',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          >
            {(['GRCh38', 'GRCh37'] as const).map((asm) => (
              <button
                key={asm}
                onClick={() => void handleAssemblySwitch(asm)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: assembly === asm ? 700 : 500,
                  backgroundColor: assembly === asm ? '#ffffff' : 'transparent',
                  color: assembly === asm ? '#2563eb' : '#64748b',
                  borderRadius: '6px',
                  border: 'none',
                  boxShadow: assembly === asm ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {asm} ({asm === 'GRCh38' ? 'hg38' : 'hg19'})
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              const next = !isAirgapped;
              opfs.setAirgapped(next);
              setIsAirgapped(next);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: isAirgapped ? '1px solid #86efac' : '1px solid #e2e8f0',
              backgroundColor: isAirgapped ? '#f0fdf4' : '#ffffff',
              color: isAirgapped ? '#166534' : '#475569',
            }}
          >
            {isAirgapped ? (
              <ShieldCheck size={15} color="#16a34a" />
            ) : (
              <Shield size={15} color="#64748b" />
            )}
            {isAirgapped ? 'OPFS Airgap Active' : 'Edge Range Streaming'}
          </button>

          {!isOpfsCached && (
            <button
              onClick={() => void handleCacheToOpfs()}
              disabled={cachingProgress !== null}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: cachingProgress !== null ? 'wait' : 'pointer',
                border: '1px solid #2563eb',
                backgroundColor: '#2563eb',
                color: '#ffffff',
              }}
            >
              <Download size={14} />
              {cachingProgress !== null ? `Caching (${cachingProgress}%)` : 'Cache to OPFS'}
            </button>
          )}
        </div>
      </div>

      {/* Honest Error Banner (if network / OPFS fails) */}
      {loadError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 18px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            color: '#991b1b',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} color="#dc2626" />
            <span>
              <strong>Container Range Slice Failed:</strong> {loadError}
            </span>
          </div>
          <button
            onClick={() => void fetchLocusData(selectedChrom, windowStart, windowEnd, assembly)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #fca5a5',
              backgroundColor: '#ffffff',
              color: '#991b1b',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Dynamically Discovered Indexed Loci */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          padding: '4px 0',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginRight: '4px' }}>
          Indexed Loci in .plasmid:
        </span>
        {indexedChips.length === 0 ? (
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            {isLoading ? 'Reading container directory…' : 'No indexed variant leaves loaded'}
          </span>
        ) : (
          indexedChips.map((chip) => {
            const isChipActive =
              selectedChrom === chip.chrom &&
              chip.pos >= windowStart &&
              chip.pos <= windowEnd;
            const isPathogenic = chip.clinvar?.toLowerCase().includes('pathogenic');

            return (
              <button
                key={chip.key}
                onClick={() => void handleJumpToChip(chip)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: isChipActive ? 700 : 500,
                  border: isChipActive ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  backgroundColor: isChipActive ? '#eff6ff' : '#ffffff',
                  color: isChipActive ? '#2563eb' : '#334155',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isPathogenic ? '#dc2626' : '#f59e0b',
                  }}
                />
                {chip.label}
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  ({chip.chrom}:{(chip.pos / 1_000_000).toFixed(2)}M)
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* 3. Level 0: Whole-Genome Pyramid Overview */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
            Level 0: .plasmid Pyramid Karyotype Overview ({assembly})
          </span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {containerPyramid
              ? `${containerPyramid.total_variants} indexed variant(s), ${containerPyramid.total_pathogenic} pathogenic`
              : 'Loading pyramid metadata…'}
          </span>
        </div>
        <div style={{ height: '70px', width: '100%' }}>
          <canvas
            ref={karyotypeCanvasRef}
            onClick={(e) => {
              const canvas = karyotypeCanvasRef.current;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const colWidth = (rect.width - 16) / ORDERED_CHROMOSOMES.length;
              const idx = Math.floor((x - 8) / colWidth);
              if (idx >= 0 && idx < ORDERED_CHROMOSOMES.length) {
                const targetChr = ORDERED_CHROMOSOMES[idx];
                setSelectedChrom(targetChr);
                const overview = activeChromosomesMap.get(targetChr);
                const center = overview ? Math.round(overview.length / 2) : 50_000_000;
                setWindowStart(Math.max(1, center - 10_000_000));
                setWindowEnd(center + 10_000_000);
              }
            }}
            style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* 4. Level 1: Chromosome Arm Geometry & 1Mb Pyramid Density Bar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              {selectedChrom} 1Mb Pyramid Density &amp; Centromere Map
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {currentChromOverview
                ? `${(currentChromOverview.length / 1_000_000).toFixed(2)} Mb • cen ${(currentChromOverview.centromere / 1_000_000).toFixed(1)} Mb`
                : ''}
            </span>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'ui-monospace, monospace',
              color: '#2563eb',
              backgroundColor: '#eff6ff',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 600,
            }}
          >
            Window: {windowStart.toLocaleString()} - {windowEnd.toLocaleString()} bp (
            {((windowEnd - windowStart) / 1000).toFixed(1)} kb)
          </span>
        </div>

        <div style={{ height: '48px', width: '100%', position: 'relative' }}>
          <canvas
            ref={overviewBarCanvasRef}
            onClick={(e) => {
              const canvas = overviewBarCanvasRef.current;
              if (!canvas || !currentChromOverview) return;
              const rect = canvas.getBoundingClientRect();
              const padX = 24;
              const drawW = rect.width - padX * 2;
              const clickX = e.clientX - rect.left - padX;
              if (clickX >= 0 && clickX <= drawW) {
                const targetBp = Math.round((clickX / drawW) * currentChromOverview.length);
                const span = Math.max(200, windowEnd - windowStart);
                const newStart = Math.max(1, Math.round(targetBp - span / 2));
                setWindowStart(newStart);
                setWindowEnd(Math.min(currentChromOverview.length, newStart + span));
              }
            }}
            style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
          />
        </div>
      </div>

      {/* 5. Level 2/3: Multi-Track Canvas Viewport */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '12px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              High-Resolution .plasmid Slice Viewport
            </span>
            {isLoading && (
              <span
                style={{
                  fontSize: '11px',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <RefreshCw size={12} /> Slicing &amp; decoding via WASM…
              </span>
            )}
            {!isLoading && lastQueryResult?.slicingPlan && (
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'ui-monospace, monospace',
                  color: '#475569',
                  backgroundColor: '#f8fafc',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid #e2e8f0',
                }}
              >
                {lastQueryResult.slicingPlan.byte_ranges.length > 0
                  ? `Range: bytes=${lastQueryResult.slicingPlan.byte_ranges
                      .map((r) => `${r.start}-${r.end}`)
                      .join(',')}`
                  : '0 chunks needed'}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => {
                setWindowStart(1);
                setWindowEnd(200);
              }}
              title="Jump to 1-200 bp (Reference FASTA block)"
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                fontSize: '11px',
                fontWeight: 600,
                color: '#0f766e',
                cursor: 'pointer',
              }}
            >
              1–200 bp (FASTA)
            </button>
            <button
              onClick={() => handlePan('left')}
              title="Pan Left"
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <ChevronLeft size={15} color="#475569" />
            </button>
            <button
              onClick={() => handlePan('right')}
              title="Pan Right"
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <ChevronRight size={15} color="#475569" />
            </button>
            <div style={{ width: '1px', height: '16px', backgroundColor: '#e2e8f0', margin: '0 4px' }} />
            <button
              onClick={() => handleZoom(0.5)}
              title="Zoom In (2x)"
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <ZoomIn size={15} color="#475569" />
            </button>
            <button
              onClick={() => handleZoom(2.0)}
              title="Zoom Out (0.5x)"
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <ZoomOut size={15} color="#475569" />
            </button>
          </div>
        </div>

        <div style={{ position: 'relative', width: '100%', height: '260px' }}>
          <canvas
            ref={trackCanvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'block',
            }}
          />
          <canvas
            ref={overlayCanvasRef}
            onMouseMove={handleMouseMove}
            onClick={() => {
              if (hoveredVariant) {
                setSelectedVariantPos(hoveredVariant.pos);
              }
            }}
            onMouseLeave={() => {
              setHoverPos(null);
              setHoveredVariant(null);
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'block',
              cursor: hoveredVariant ? 'pointer' : 'crosshair',
            }}
          />
        </div>
      </div>

      {/* 6. Decoded Slice & Variant Inspector (Strictly Real .plasmid Data) */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {inspectedVariant ? (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    {inspectedVariant.gene || 'Unannotated Gene'} • {inspectedVariant.id}
                  </h3>
                  {inspectedVariant.clinvar && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: inspectedVariant.score >= 10 ? '#fee2e2' : '#fef3c7',
                        color: inspectedVariant.score >= 10 ? '#dc2626' : '#b45309',
                      }}
                    >
                      {inspectedVariant.clinvar}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: '12px',
                      fontFamily: 'ui-monospace, monospace',
                      color: '#475569',
                    }}
                  >
                    FILTER={inspectedVariant.filter}
                    {inspectedVariant.qual !== null ? ` • QUAL=${inspectedVariant.qual}` : ''}
                  </span>
                </div>
                {annotations.length > 0 && (
                  <p style={{ fontSize: '13px', color: '#475569', margin: '6px 0 0 0' }}>
                    {annotations[0].title}: {annotations[0].content}
                  </p>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0f172a',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {inspectedVariant.chrom}:{inspectedVariant.pos.toLocaleString()} (
                  {inspectedVariant.ref} &gt; {inspectedVariant.alt})
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Displayed Assembly: <strong style={{ color: '#2563eb' }}>{assembly}</strong>
                  {lastQueryResult?.session.header.reference_build
                    ? ` (Container: ${lastQueryResult.session.header.reference_build})`
                    : ''}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                  Decoded VCF INFO Attributes
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#0f172a',
                    fontFamily: 'ui-monospace, monospace',
                    marginTop: '4px',
                    wordBreak: 'break-all',
                  }}
                >
                  {Object.keys(inspectedVariant.info).length > 0
                    ? Object.entries(inspectedVariant.info)
                        .map(([k, v]) => `${k}=${v}`)
                        .join('; ')
                    : 'No INFO tags'}
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                  Chunk Slicing &amp; Byte Transfer
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#0f172a',
                    fontFamily: 'ui-monospace, monospace',
                    marginTop: '4px',
                  }}
                >
                  Chunks: #{lastQueryResult?.slicingPlan?.chunk_indices.join(', #') || 'none'}
                  <br />
                  Slice Size:{' '}
                  {(lastQueryResult?.slicingPlan?.total_download_bytes ?? 0).toLocaleString()} B /{' '}
                  {(lastQueryResult?.session.totalFileSize ?? 0).toLocaleString()} B
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                  WASM Chunk SHA-256 Digest
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#16a34a',
                    fontFamily: 'ui-monospace, monospace',
                    fontWeight: 600,
                    marginTop: '4px',
                    wordBreak: 'break-all',
                  }}
                >
                  {chunkHashes.length > 0
                    ? chunkHashes
                        .map((c) => `#${c.chunk_index}: ${c.sha256_hex.slice(0, 24)}…`)
                        .join(' | ')
                    : 'No chunk digest'}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              color: '#64748b',
              fontSize: '13px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Database size={16} color="#94a3b8" />
              <span>
                {loadError
                  ? 'Unable to inspect variants until container range access succeeds.'
                  : `No decoded VCF variants in ${selectedChrom}:${windowStart.toLocaleString()}-${windowEnd.toLocaleString()} (${assembly}).${
                      referenceSequence
                        ? ` Decoded ${referenceSequence.length} bp ReferenceFasta sequence.`
                        : ''
                    }`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 7. Engine Telemetry Log Drawer */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Activity size={14} color="#2563eb" /> .plasmid Range Streaming &amp; WASM Audit Log
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Latest {logs.length} events</span>
        </div>
        <div
          style={{
            maxHeight: '130px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '11px',
          }}
        >
          {logs.map((log) => (
            <div key={log.id} style={{ display: 'flex', gap: '10px', color: '#475569' }}>
              <span style={{ color: '#94a3b8' }}>[{log.timestamp}]</span>
              <span
                style={{
                  fontWeight: 600,
                  color:
                    log.type === 'opfs'
                      ? '#16a34a'
                      : log.type === 'network'
                        ? '#2563eb'
                        : '#d97706',
                }}
              >
                [{log.type.toUpperCase()}]
              </span>
              <span>{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
