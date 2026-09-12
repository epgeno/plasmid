import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Shield,
  ShieldCheck,
  HardDrive,
  Download,
  Trash2,
  RefreshCw,
  Layers,
} from 'lucide-react';
import {
  ORDERED_CHROMOSOMES,
  getChromosomes,
  getChromosomeCytobands,
  getStainColor,
  type GenomeAssembly,
} from '../services/cytoband';
import { OPFSManager } from '../services/opfs';
import { decoderClient } from '../services/decoderClient';
import type { ParsedVariant, DensityBin } from '../workers/genome-decoder.worker';

interface BenchmarkLocus {
  gene: string;
  chrom: string;
  start: number;
  end: number;
  description: string;
  significance: 'Pathogenic' | 'Risk Factor' | 'VUS';
}

const BENCHMARK_LOCI: BenchmarkLocus[] = [
  {
    gene: 'BRAF V600E',
    chrom: 'chr7',
    start: 140453100,
    end: 140453200,
    description: 'Melanoma / Colorectal Hotspot (c.1799T>A)',
    significance: 'Pathogenic',
  },
  {
    gene: 'TP53 R273H',
    chrom: 'chr17',
    start: 7668400,
    end: 7687550,
    description: 'Li-Fraumeni Syndrome / Multi-Cancer Suppressor',
    significance: 'Pathogenic',
  },
  {
    gene: 'BRCA2 6174delT',
    chrom: 'chr13',
    start: 32315080,
    end: 32400300,
    description: 'Hereditary Breast and Ovarian Cancer',
    significance: 'Pathogenic',
  },
  {
    gene: 'APOE e4',
    chrom: 'chr19',
    start: 44905000,
    end: 44909000,
    description: 'Late-onset Alzheimer Disease Risk Allele',
    significance: 'Risk Factor',
  },
];

export const GenomeNavigator: React.FC = () => {
  // State: Assembly & Locus Viewport
  const [assembly, setAssembly] = useState<GenomeAssembly>('GRCh38');
  const [selectedChrom, setSelectedChrom] = useState<string>('chr7');
  const [windowStart, setWindowStart] = useState<number>(140450000);
  const [windowEnd, setWindowEnd] = useState<number>(140456000);

  // State: OPFS & Airgap Mode
  const opfs = useMemo(() => OPFSManager.getInstance(), []);
  const [isAirgapped, setIsAirgapped] = useState<boolean>(opfs.isAirgapped());
  const [isOpfsSupported, setIsOpfsSupported] = useState<boolean>(true);
  const [hasLocalDataset, setHasLocalDataset] = useState<boolean>(false);
  const [isCachingOpfs, setIsCachingOpfs] = useState<boolean>(false);
  const [cachingProgress, setCachingProgress] = useState<number>(0);
  const [storageQuota, setStorageQuota] = useState<{ usage: string; quota: string; percent: number } | null>(null);

  // State: Genomic Data & Loading
  const [variants, setVariants] = useState<ParsedVariant[]>([]);
  const [densityBins, setDensityBins] = useState<DensityBin[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hoveredVariant, setHoveredVariant] = useState<ParsedVariant | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [networkLog, setNetworkLog] = useState<{ time: string; msg: string; type: 'network' | 'opfs' | 'cache' }[]>([]);

  // Canvas Refs
  const trackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chroms = useMemo(() => getChromosomes(assembly), [assembly]);
  const currentChromDef = chroms[selectedChrom] || chroms['chr1'];
  const windowSpan = Math.max(windowEnd - windowStart, 1);

  // Initialize OPFS status
  const checkOpfsStatus = useCallback(async () => {
    const supported = opfs.isSupported();
    setIsOpfsSupported(supported);
    if (supported) {
      const exists = await opfs.hasFile('demo.plasmid');
      setHasLocalDataset(exists);
      const quota = await opfs.getQuota();
      if (quota) {
        setStorageQuota({
          usage: quota.usageFormatted,
          quota: quota.quotaFormatted,
          percent: quota.percentUsed,
        });
      }
    }
  }, [opfs]);

  useEffect(() => {
    checkOpfsStatus();
  }, [checkOpfsStatus]);

  const addLog = (msg: string, type: 'network' | 'opfs' | 'cache') => {
    const time = new Date().toLocaleTimeString();
    setNetworkLog((prev) => [{ time, msg, type }, ...prev.slice(0, 19)]);
  };

  // Toggle Airgap Mode
  const handleToggleAirgap = (enabled: boolean) => {
    if (enabled && !hasLocalDataset) {
      alert('Local OPFS dataset not found. Please download the dataset first before enabling Airgap mode.');
      return;
    }
    opfs.setAirgapped(enabled);
    setIsAirgapped(enabled);
    addLog(
      enabled
        ? 'AIRGAP ACTIVATED: Network requests completely blocked. Data read 100% from local OPFS.'
        : 'AIRGAP DEACTIVATED: Switched back to Cloudflare R2 edge streaming.',
      enabled ? 'opfs' : 'network'
    );
  };

  // Download remote dataset to OPFS
  const handleDownloadToOpfs = async () => {
    if (!isOpfsSupported) return;
    try {
      setIsCachingOpfs(true);
      setCachingProgress(0);
      addLog('Starting download of demo.plasmid into local OPFS sandbox...', 'opfs');

      await opfs.cacheRemoteDataset('/api/data/demo.plasmid', '/api/data/demo.plasmid', (received, total) => {
        if (total > 0) {
          setCachingProgress(Math.round((received / total) * 100));
        }
      });

      setHasLocalDataset(true);
      setIsCachingOpfs(false);
      await checkOpfsStatus();
      addLog('Dataset demo.plasmid securely stored in OPFS. Ready for airgapped operation.', 'opfs');
    } catch (err: any) {
      setIsCachingOpfs(false);
      addLog(`Failed to download to OPFS: ${err.message}`, 'network');
    }
  };

  // Delete dataset from OPFS
  const handleDeleteFromOpfs = async () => {
    try {
      await opfs.deleteFile('demo.plasmid');
      setHasLocalDataset(false);
      if (isAirgapped) {
        handleToggleAirgap(false);
      }
      await checkOpfsStatus();
      addLog('Local OPFS dataset removed.', 'opfs');
    } catch (err: any) {
      addLog(`Failed to remove OPFS dataset: ${err.message}`, 'opfs');
    }
  };

  // Load genomic chunk data (Debounced + AbortController + OPFS/R2 route)
  const fetchLocusData = useCallback(async (chrom: string, start: number, end: number) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);

    try {
      let buffer: ArrayBuffer;

      if (isAirgapped) {
        // 100% Local OPFS Airgap Slice
        addLog(`OPFS Airgap Slice: reading 16KB chunk for ${chrom}:${start}-${end}`, 'opfs');
        buffer = await opfs.readRange('demo.plasmid', 0, 16384 * 4);
      } else {
        // Cloudflare R2 HTTP 206 Streaming
        addLog(`Edge R2 Range Request: /api/data/demo.plasmid (Range: bytes=0-65535)`, 'network');
        const res = await fetch('/api/data/demo.plasmid', {
          headers: { Range: 'bytes=0-65535' },
          signal: controller.signal,
        });
        if (!res.ok && res.status !== 206) {
          throw new Error(`HTTP ${res.status} streaming error`);
        }
        buffer = await res.arrayBuffer();
      }

      // Background Web Worker decoding
      const decodedVariants = await decoderClient.parseVcfChunk(buffer, chrom, start, end);
      setVariants(decodedVariants);

      // Compute density bins for wide spans (> 20kb)
      if (end - start > 20000) {
        const bins = await decoderClient.computeDensityBins(decodedVariants, start, end, 80);
        setDensityBins(bins);
      } else {
        setDensityBins([]);
      }

      setIsLoading(false);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Fetch locus error:', err);
        setIsLoading(false);
      }
    }
  }, [isAirgapped, opfs]);

  // Viewport change with 120ms debounce
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchLocusData(selectedChrom, windowStart, windowEnd);
    }, 120);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [selectedChrom, windowStart, windowEnd, fetchLocusData]);

  // Navigation Helpers
  const handleZoom = (direction: 'in' | 'out', factor: number = 2) => {
    const currentSpan = windowEnd - windowStart;
    const center = Math.floor((windowStart + windowEnd) / 2);
    let newSpan = direction === 'in' ? Math.floor(currentSpan / factor) : Math.floor(currentSpan * factor);
    
    // Bounds: minimum 80bp, maximum whole chromosome
    newSpan = Math.max(80, Math.min(newSpan, currentChromDef.length));
    
    const newStart = Math.max(0, center - Math.floor(newSpan / 2));
    const newEnd = Math.min(currentChromDef.length, newStart + newSpan);
    
    setWindowStart(newStart);
    setWindowEnd(newEnd);
  };

  const handlePan = (deltaPct: number) => {
    const shift = Math.floor((windowEnd - windowStart) * deltaPct);
    let newStart = windowStart + shift;
    let newEnd = windowEnd + shift;

    if (newStart < 0) {
      newEnd += -newStart;
      newStart = 0;
    }
    if (newEnd > currentChromDef.length) {
      newStart -= newEnd - currentChromDef.length;
      newEnd = currentChromDef.length;
    }

    setWindowStart(Math.max(0, newStart));
    setWindowEnd(Math.min(currentChromDef.length, newEnd));
  };

  const jumpToLocus = (locus: BenchmarkLocus) => {
    setSelectedChrom(locus.chrom);
    setWindowStart(locus.start);
    setWindowEnd(locus.end);
  };

  // Render Layer 1: Track Canvas (Background Grid, Cytobands, Bins, Variants, Nucleotides)
  useEffect(() => {
    const canvas = trackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // 1. Coordinate Ruler
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, width, 24);
    ctx.strokeStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.lineTo(width, 24);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    const numTicks = 6;
    for (let i = 0; i <= numTicks; i++) {
      const x = (width * i) / numTicks;
      const bp = Math.floor(windowStart + (windowSpan * i) / numTicks);
      const label = bp > 1000000 ? `${(bp / 1000000).toFixed(3)} Mb` : `${(bp / 1000).toFixed(1)} kb`;
      ctx.fillText(label, Math.max(2, Math.min(x - 20, width - 60)), 16);
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, 24);
      ctx.stroke();
    }

    // 2. High-Density Bins or Discrete Variants
    if (windowSpan > 20000 && densityBins.length > 0) {
      // Density Binning Mode (draw calls < 100)
      const binWidth = width / densityBins.length;
      const maxScore = Math.max(...densityBins.map((b) => b.score), 1);

      densityBins.forEach((bin, idx) => {
        if (bin.count === 0) return;
        const x = idx * binWidth;
        const barHeight = Math.min(40, (bin.score / maxScore) * 40);
        const y = 80 - barHeight;

        // Color based on pathogenicity
        if (bin.pathogenicCount > 0) {
          ctx.fillStyle = '#EF4444'; // Pathogenic red
        } else if (bin.score > 2) {
          ctx.fillStyle = '#F59E0B'; // VUS amber
        } else {
          ctx.fillStyle = '#2563EB'; // Benign blue
        }

        ctx.fillRect(x, y, Math.max(1, binWidth - 1), barHeight);
      });

      // Density axis label
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Variant Density (Binned)', 8, 38);
    } else {
      // Individual Variant Markings
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Variants & Annotations', 8, 38);

      variants.forEach((v) => {
        const x = ((v.pos - windowStart) / windowSpan) * width;
        if (x < -10 || x > width + 10) return;

        const isPathogenic = v.clinvar?.toLowerCase().includes('pathogenic');
        const isBenign = v.clinvar?.toLowerCase().includes('benign');

        ctx.beginPath();
        ctx.arc(x, 60, isPathogenic ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isPathogenic ? '#EF4444' : isBenign ? '#10B981' : '#2563EB';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label above
        if (windowSpan < 5000) {
          ctx.fillStyle = '#1E293B';
          ctx.font = '10px sans-serif';
          ctx.fillText(`${v.ref}>${v.alt}`, x - 8, 48);
        }
      });
    }

    // 3. Base-Pair Nucleotide View (Level 4: < 120 bp)
    if (windowSpan <= 120) {
      const bpWidth = width / windowSpan;
      ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';

      // Synthetic sequence representation for demo
      const bases = ['A', 'C', 'G', 'T'];
      for (let i = 0; i < windowSpan; i++) {
        const pos = windowStart + i;
        const x = i * bpWidth + bpWidth / 2;
        const base = bases[(pos * 7 + 3) % 4];

        // Color coding: A: Green, C: Blue, G: Amber, T: Red
        let color = '#10B981';
        if (base === 'C') color = '#2563EB';
        if (base === 'G') color = '#F59E0B';
        if (base === 'T') color = '#EF4444';

        ctx.fillStyle = `${color}20`;
        ctx.fillRect(i * bpWidth, 100, bpWidth, 24);

        ctx.fillStyle = color;
        ctx.fillText(base, x, 116);
      }
      ctx.textAlign = 'start';
    }
  }, [windowStart, windowSpan, densityBins, variants]);

  // Render Layer 2: Interactive Overlay Canvas (Hairline Cursor & Hover Tooltip)
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (mousePos) {
      // Draw vertical hairline crosshair
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(mousePos.x, 0);
      ctx.lineTo(mousePos.x, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Coordinate badge at cursor
      const cursorBp = Math.floor(windowStart + (mousePos.x / canvas.width) * windowSpan);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(mousePos.x - 35, 2, 70, 18);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '9px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${cursorBp.toLocaleString()} bp`, mousePos.x, 14);
      ctx.textAlign = 'start';
    }
  }, [mousePos, windowStart, windowSpan]);

  // Mouse Move over Canvas to find hovered variant
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    // Check if variant is near cursor
    const mouseBp = windowStart + (x / rect.width) * windowSpan;
    const thresholdBp = (windowSpan / rect.width) * 12; // 12px hit radius

    const found = variants.find((v) => Math.abs(v.pos - mouseBp) < thresholdBp);
    setHoveredVariant(found || null);
  };

  const handleCanvasMouseLeave = () => {
    setMousePos(null);
    setHoveredVariant(null);
  };

  // Ideogram Chromosome selection
  const handleChromSelect = (chr: string) => {
    setSelectedChrom(chr);
    const def = chroms[chr];
    // Start at middle 100kb
    const center = Math.floor(def.length / 2);
    setWindowStart(Math.max(0, center - 50000));
    setWindowEnd(Math.min(def.length, center + 50000));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Top Header & Airgap Governance Bar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              Multi-scale Whole-Genome Navigator
              <span className="text-xs px-2 py-0.5 rounded-full font-mono font-normal bg-blue-50 text-blue-700 border border-blue-200">
                Level 0~4 Semantic Zoom
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Deterministic 16KB Slicing · Web Worker Background Binning · 2-Layer Virtualized Canvas
            </p>
          </div>
        </div>

        {/* Assembly Guard & OPFS Airgap Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Assembly Selector */}
          <div className="flex items-center space-x-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs shadow-xs">
            <span className="text-slate-500 font-medium">Assembly:</span>
            <select
              value={assembly}
              onChange={(e) => setAssembly(e.target.value as GenomeAssembly)}
              aria-label="Genome Assembly Selection"
              className="font-mono font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="GRCh38">GRCh38 (hg38)</option>
              <option value="GRCh37">GRCh37 (hg19)</option>
            </select>
          </div>

          {/* Airgap Isolation Status Button */}
          <div
            className={`flex items-center space-x-2 px-3 py-1 rounded-lg border text-xs font-medium transition-all ${
              isAirgapped
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            {isAirgapped ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>OPFS Airgap: Active (Zero Net Leak)</span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 text-blue-600" />
                <span>Cloudflare R2 Edge Streaming</span>
              </>
            )}

            <button
              onClick={() => handleToggleAirgap(!isAirgapped)}
              className={`ml-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                isAirgapped
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              {isAirgapped ? 'Disable' : 'Enable Airgap'}
            </button>
          </div>

          {/* OPFS Cache Manager */}
          {isOpfsSupported && (
            <div className="flex items-center space-x-1">
              {hasLocalDataset ? (
                <button
                  onClick={handleDeleteFromOpfs}
                  title="Remove local OPFS cached dataset"
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleDownloadToOpfs}
                  disabled={isCachingOpfs}
                  className="flex items-center space-x-1 text-xs px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-xs transition-colors"
                >
                  {isCachingOpfs ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>{cachingProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Cache to OPFS</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Benchmark Loci Fast Jumps */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center overflow-x-auto space-x-2 text-xs">
        <span className="text-slate-500 font-medium shrink-0">Quick Loci:</span>
        {BENCHMARK_LOCI.map((locus) => (
          <button
            key={locus.gene}
            onClick={() => jumpToLocus(locus)}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all shrink-0 flex items-center space-x-1 border ${
              selectedChrom === locus.chrom && windowStart <= locus.start && windowEnd >= locus.end
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <span>{locus.gene}</span>
            <span className="opacity-70 text-[10px]">({locus.chrom})</span>
          </button>
        ))}
      </div>

      {/* Level 0: Whole Genome Karyotype Overview (24 Chromosomes Grid) */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700 tracking-wider uppercase">
            Level 0: Whole Genome Overview (3 Gb)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            Selected: <strong className="text-slate-900">{selectedChrom}</strong> ({((currentChromDef.length) / 1000000).toFixed(1)} Mb)
          </span>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
          {ORDERED_CHROMOSOMES.map((chr) => {
            const def = chroms[chr];
            const isSelected = selectedChrom === chr;
            // Mock ClinVar density bar height (1-10 scale)
            const isHotspotChr = chr === 'chr7' || chr === 'chr13' || chr === 'chr17' || chr === 'chr19';

            return (
              <button
                key={chr}
                onClick={() => handleChromSelect(chr)}
                className={`flex flex-col items-center p-1.5 rounded border transition-all text-center ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-500'
                    : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <span className={`text-[11px] font-mono font-medium ${isSelected ? 'text-blue-700 font-bold' : 'text-slate-700'}`}>
                  {chr.replace('chr', '')}
                </span>

                {/* Mini Cytoband Bar */}
                <div className="w-full h-1.5 bg-slate-200 rounded-xs mt-1 overflow-hidden flex">
                  <div
                    className="bg-slate-400 h-full"
                    style={{ width: `${(def.centromere.start / def.length) * 100}%` }}
                  />
                  <div className="bg-red-500 w-1 h-full" />
                  <div className="bg-slate-400 h-full flex-1" />
                </div>

                {/* ClinVar Pathogenic Indicator */}
                <div className="w-full h-1 bg-slate-100 mt-0.5 rounded-xs overflow-hidden">
                  {isHotspotChr && (
                    <div className="bg-red-500 h-full w-2/3" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Level 1: Chromosome Cytoband Viewfinder Ribbon */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/30">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-700 tracking-wider uppercase flex items-center gap-1.5">
            Level 1: {selectedChrom} Cytoband & Viewfinder
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Window: {windowStart.toLocaleString()} - {windowEnd.toLocaleString()} bp (
            {windowSpan > 1000000
              ? `${(windowSpan / 1000000).toFixed(3)} Mb`
              : windowSpan > 1000
              ? `${(windowSpan / 1000).toFixed(1)} kb`
              : `${windowSpan} bp`}
            )
          </span>
        </div>

        {/* Chromosome Band Bar with Draggable Brush Box */}
        <div className="relative h-7 bg-slate-200 rounded-md border border-slate-300 overflow-hidden select-none">
          {/* Cytoband segments */}
          {getChromosomeCytobands(selectedChrom, assembly).map((band, idx) => {
            const startPct = (band.start / currentChromDef.length) * 100;
            const widthPct = ((band.end - band.start) / currentChromDef.length) * 100;
            return (
              <div
                key={idx}
                className="absolute top-0 bottom-0 border-r border-slate-300/40 text-[9px] text-slate-600 flex items-center justify-center font-mono overflow-hidden opacity-90"
                style={{
                  left: `${startPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: getStainColor(band.stain),
                }}
                title={`${band.name} (${band.start}-${band.end})`}
              >
                {widthPct > 5 && band.name}
              </div>
            );
          })}

          {/* Interactive Red/Blue Viewfinder Lens */}
          <div
            className="absolute top-0 bottom-0 border-2 border-blue-600 bg-blue-500/20 rounded cursor-move transition-all z-10"
            style={{
              left: `${Math.max(0, (windowStart / currentChromDef.length) * 100)}%`,
              width: `${Math.max(0.5, (windowSpan / currentChromDef.length) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Navigation Toolbar (Zoom, Pan, Scale) */}
      <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => handlePan(-0.25)}
            className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded font-medium shadow-xs"
          >
            ← Pan Left
          </button>
          <button
            onClick={() => handlePan(0.25)}
            className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded font-medium shadow-xs"
          >
            Pan Right →
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          <button
            onClick={() => handleZoom('in', 2)}
            className="flex items-center space-x-1 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded font-medium shadow-xs"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>Zoom In (2x)</span>
          </button>
          <button
            onClick={() => handleZoom('out', 2)}
            className="flex items-center space-x-1 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded font-medium shadow-xs"
          >
            <ZoomOut className="w-3.5 h-3.5" />
            <span>Zoom Out (2x)</span>
          </button>
        </div>

        <div className="flex items-center space-x-3 text-slate-500">
          {isLoading && (
            <span className="flex items-center space-x-1 text-blue-600 font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Fetching Slices...</span>
            </span>
          )}
          <span>
            Resolution Level:{' '}
            <strong className="text-slate-800">
              {windowSpan > 10000000
                ? 'Level 1 (Chromosome)'
                : windowSpan > 100000
                ? 'Level 2 (Locus / 100kb)'
                : windowSpan > 500
                ? 'Level 3 (Variant / 1kb)'
                : 'Level 4 (Nucleotide / 1bp)'}
            </strong>
          </span>
        </div>
      </div>

      {/* Level 2 & 3: 2-Layer Canvas Rendering Area */}
      <div className="relative h-[280px] bg-slate-50/50 select-none overflow-hidden">
        {/* Layer 1: Background Track Canvas (Ruler, Density Bins, Exon boxes) */}
        <canvas
          ref={trackCanvasRef}
          width={1000}
          height={280}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Layer 2: Interactive Overlay Canvas (Hairline Crosshairs, Hover Tooltips) */}
        <canvas
          ref={overlayCanvasRef}
          width={1000}
          height={280}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          className="absolute inset-0 w-full h-full cursor-crosshair z-10"
        />

        {/* Floating Variant Inspection Card */}
        {hoveredVariant && mousePos && (
          <div
            className="absolute z-20 bg-slate-900 text-white rounded-lg p-2.5 text-xs shadow-xl pointer-events-none max-w-xs border border-slate-700"
            style={{
              left: Math.min(mousePos.x + 12, 700),
              top: Math.max(10, mousePos.y - 80),
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1 mb-1.5">
              <span className="font-mono font-bold text-blue-400">{hoveredVariant.id || 'Novel Variant'}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  hoveredVariant.clinvar?.toLowerCase().includes('pathogenic')
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {hoveredVariant.clinvar || 'Unclassified'}
              </span>
            </div>
            <div className="space-y-0.5 text-[11px] text-slate-300">
              <div>
                Coordinate: <span className="font-mono text-white">{hoveredVariant.chrom}:{hoveredVariant.pos.toLocaleString()}</span>
              </div>
              <div>
                Allele: <span className="font-mono text-white">{hoveredVariant.ref} → {hoveredVariant.alt}</span>
              </div>
              {hoveredVariant.gene && (
                <div>
                  Gene: <span className="font-semibold text-white">{hoveredVariant.gene}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Network & OPFS Audit Telemetry Log */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
            Security & Streaming Telemetry (RFC-0002 Airgap Audit)
          </span>
          {storageQuota && (
            <span className="text-[11px] font-mono text-slate-500">
              OPFS Sandbox: {storageQuota.usage} / {storageQuota.quota} ({storageQuota.percent}%)
            </span>
          )}
        </div>

        <div className="h-24 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] space-y-1">
          {networkLog.length === 0 ? (
            <span className="text-slate-400 italic">No network or storage operations logged yet.</span>
          ) : (
            networkLog.map((item, idx) => (
              <div key={idx} className="flex items-start space-x-2">
                <span className="text-slate-400 shrink-0">[{item.time}]</span>
                <span
                  className={`px-1 py-0.2 rounded text-[10px] uppercase font-semibold shrink-0 ${
                    item.type === 'opfs'
                      ? 'bg-emerald-100 text-emerald-800'
                      : item.type === 'network'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {item.type}
                </span>
                <span className="text-slate-700">{item.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
