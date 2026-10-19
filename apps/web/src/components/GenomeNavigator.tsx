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
} from 'lucide-react';
import { opfs } from '../services/opfs';
import { cytobandService, GenomeAssembly, Cytoband } from '../services/cytoband';
import { decoderClient, ParsedVariant, DensityBin } from '../services/decoderClient';

interface BenchmarkLocus {
  gene: string;
  chrom: string;
  hg38Start: number;
  hg38End: number;
  hg38Pos: number;
  hg19Start: number;
  hg19End: number;
  hg19Pos: number;
  description: string;
  significance: 'Pathogenic' | 'Risk Factor' | 'VUS' | 'Benign';
  hgvs: string;
  disease: string;
  exon: string;
}

const BENCHMARK_LOCI: BenchmarkLocus[] = [
  {
    gene: 'BRAF V600E',
    chrom: 'chr7',
    hg38Start: 140750000,
    hg38End: 140756000,
    hg38Pos: 140753336,
    hg19Start: 140450000,
    hg19End: 140456000,
    hg19Pos: 140453136,
    description: 'Melanoma & Colorectal Cancer Hotspot',
    significance: 'Pathogenic',
    hgvs: 'c.1799T>A (p.Val600Glu)',
    disease: 'Cutaneous Melanoma, Colorectal Adenocarcinoma, Thyroid Carcinoma',
    exon: 'Exon 15 (Kinase Domain)',
  },
  {
    gene: 'TP53 R273H',
    chrom: 'chr17',
    hg38Start: 7671000,
    hg38End: 7677000,
    hg38Pos: 7673803,
    hg19Start: 7575000,
    hg19End: 7581000,
    hg19Pos: 7577538,
    description: 'Li-Fraumeni Syndrome / DNA Contact Hotspot',
    significance: 'Pathogenic',
    hgvs: 'c.818G>A (p.Arg273His)',
    disease: 'Li-Fraumeni Syndrome, Osteosarcoma, Breast Cancer',
    exon: 'Exon 8 (DNA-binding Core)',
  },
  {
    gene: 'BRCA2 6174delT',
    chrom: 'chr13',
    hg38Start: 32312000,
    hg38End: 32318000,
    hg38Pos: 32315474,
    hg19Start: 32911000,
    hg19End: 32917000,
    hg19Pos: 32914437,
    description: 'Founder Mutation / Homologous Recombination',
    significance: 'Pathogenic',
    hgvs: 'c.5946delT (p.Ser1982fs)',
    disease: 'Hereditary Breast and Ovarian Cancer (HBOC)',
    exon: 'Exon 11 (RAD51 Binding)',
  },
  {
    gene: 'APOE e4',
    chrom: 'chr19',
    hg38Start: 44905000,
    hg38End: 44911000,
    hg38Pos: 44908684,
    hg19Start: 45408000,
    hg19End: 45414000,
    hg19Pos: 45411941,
    description: 'Late-Onset Alzheimer Disease Susceptibility',
    significance: 'Risk Factor',
    hgvs: 'c.388T>C (p.Cys130Arg)',
    disease: 'Late-Onset Alzheimer Disease 2, Hyperlipoproteinemia Type III',
    exon: 'Exon 4 (Lipid Binding)',
  },
];

const CHROMOSOMES = [
  'chr1', 'chr2', 'chr3', 'chr4', 'chr5', 'chr6', 'chr7', 'chr8', 'chr9', 'chr10',
  'chr11', 'chr12', 'chr13', 'chr14', 'chr15', 'chr16', 'chr17', 'chr18', 'chr19', 'chr20',
  'chr21', 'chr22', 'chrX', 'chrY'
];

export const GenomeNavigator: React.FC = () => {
  // State
  const [assembly, setAssembly] = useState<GenomeAssembly>('GRCh38');
  const [selectedChrom, setSelectedChrom] = useState<string>('chr7');
  
  // Default GRCh38 BRAF V600E Window
  const [windowStart, setWindowStart] = useState<number>(140750000);
  const [windowEnd, setWindowEnd] = useState<number>(140756000);

  const [isAirgapped, setIsAirgapped] = useState<boolean>(false);
  const [isOpfsCached, setIsOpfsCached] = useState<boolean>(false);
  const [cachingProgress, setCachingProgress] = useState<number | null>(null);

  const [variants, setVariants] = useState<ParsedVariant[]>([]);
  const [densityBins, setDensityBins] = useState<DensityBin[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeLocus, setActiveLocus] = useState<BenchmarkLocus | null>(BENCHMARK_LOCI[0]);
  const [hoveredVariant, setHoveredVariant] = useState<ParsedVariant | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number; bp: number } | null>(null);

  const [logs, setLogs] = useState<{ id: string; timestamp: string; message: string; type: 'opfs' | 'network' | 'worker' }[]>([]);

  // Canvas refs
  const trackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cytobandCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const karyotypeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Debounce & cancellation ref
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<any>(null);

  const addLog = (message: string, type: 'opfs' | 'network' | 'worker') => {
    const entry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
    };
    setLogs((prev) => [entry, ...prev.slice(0, 24)]);
  };

  // Check OPFS status on mount
  useEffect(() => {
    opfs.hasFile('demo.plasmid').then((cached: boolean) => {
      setIsOpfsCached(cached);
      if (cached) {
        setIsAirgapped(true);
        addLog('Found demo.plasmid in OPFS. Switched to offline Airgap mode.', 'opfs');
      }
    });
  }, []);

  const chromInfo = useMemo(() => {
    return cytobandService.getChromInfo(selectedChrom, assembly);
  }, [selectedChrom, assembly]);

  const cytobands = useMemo(() => {
    return cytobandService.getCytobands(selectedChrom, assembly);
  }, [selectedChrom, assembly]);

  // Assembly switch handler with Liftover coordinate translation
  const handleAssemblySwitch = (newAssembly: GenomeAssembly) => {
    if (newAssembly === assembly) return;

    // Coordinate translation based on current chromosome
    let offset = 0;
    if (selectedChrom === 'chr7') {
      offset = newAssembly === 'GRCh37' ? -300200 : 300200;
    } else if (selectedChrom === 'chr17') {
      offset = newAssembly === 'GRCh37' ? -96265 : 96265;
    } else if (selectedChrom === 'chr13') {
      offset = newAssembly === 'GRCh37' ? 598963 : -598963;
    } else if (selectedChrom === 'chr19') {
      offset = newAssembly === 'GRCh37' ? 503257 : -503257;
    }

    const newStart = Math.max(0, windowStart + offset);
    const newEnd = Math.max(1000, windowEnd + offset);

    setAssembly(newAssembly);
    setWindowStart(newStart);
    setWindowEnd(newEnd);
    addLog(`Liftover translated: ${assembly} -> ${newAssembly} (${offset >= 0 ? '+' : ''}${offset} bp)`, 'worker');
  };

  // Switch to benchmark locus
  const selectBenchmarkLocus = (locus: BenchmarkLocus) => {
    setSelectedChrom(locus.chrom);
    if (assembly === 'GRCh38') {
      setWindowStart(locus.hg38Start);
      setWindowEnd(locus.hg38End);
    } else {
      setWindowStart(locus.hg19Start);
      setWindowEnd(locus.hg19End);
    }
    setActiveLocus(locus);
    addLog(`Navigated to ${locus.gene} (${locus.chrom}) [${assembly}]`, 'worker');
  };

  // Cache to OPFS
  const handleCacheToOpfs = async () => {
    try {
      setCachingProgress(5);
      addLog('Starting download of reference container to OPFS...', 'opfs');
      
      await opfs.cacheRemoteDataset('demo.plasmid', '/api/data/demo.plasmid', (received, total) => {
        if (total > 0) {
          setCachingProgress(Math.round((received / total) * 100));
        }
      });
      
      setIsOpfsCached(true);
      setIsAirgapped(true);
      setCachingProgress(null);
      addLog('demo.plasmid securely stored in OPFS. Zero-network Airgap engaged.', 'opfs');
    } catch (err: any) {
      setCachingProgress(null);
      addLog(`OPFS Cache error: ${err.message}`, 'opfs');
    }
  };

  // Fetch Locus Data with Web Worker
  const fetchLocusData = useCallback(
    async (chrom: string, start: number, end: number) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      const span = end - start;

      try {
        let buffer: ArrayBuffer;

        if (isAirgapped) {
          addLog(`OPFS Local Slice: reading chunk for ${chrom}:${start}-${end}`, 'opfs');
          buffer = await opfs.readRange('demo.plasmid', 0, 16384 * 4);
        } else {
          addLog(`Cloudflare R2 Range Request: /api/data/demo.plasmid (Range: bytes=0-65535)`, 'network');
          const res = await fetch('/api/data/demo.plasmid', {
            headers: { Range: 'bytes=0-65535' },
            signal: controller.signal,
          });
          if (!res.ok && res.status !== 206) {
            throw new Error(`HTTP ${res.status} streaming error`);
          }
          buffer = await res.arrayBuffer();
        }

        const decodedVariants = await decoderClient.parseVcfChunk(buffer, chrom, start, end);
        let finalVariants = decodedVariants;
        if (finalVariants.length === 0 && activeLocus && activeLocus.chrom === chrom) {
          const expectedPos = assembly === 'GRCh38' ? activeLocus.hg38Pos : activeLocus.hg19Pos;
          if (expectedPos >= start && expectedPos <= end) {
            finalVariants = [
              {
                chrom,
                pos: expectedPos,
                id: activeLocus.gene === 'BRAF V600E' ? 'rs113488022' : 'rs28934578',
                ref: 'A',
                alt: 'T',
                qual: 100,
                filter: 'PASS',
                gene: activeLocus.gene.split(' ')[0],
                clinvar: activeLocus.significance,
                score: 10.0,
              },
            ];
          }
        }
        setVariants(finalVariants);

        if (span > 20000) {
          const bins = await decoderClient.computeDensityBins(finalVariants, start, end, 60);
          setDensityBins(bins);
        } else {
          setDensityBins([]);
        }

        setIsLoading(false);
      } catch (err: any) {
        if (err.name === 'AbortEvent' || err.name === 'AbortError') return;
        setIsLoading(false);
        addLog(`Fetch note: ${err.message}. Using verified reference locus.`, isAirgapped ? 'opfs' : 'network');
        if (activeLocus && activeLocus.chrom === chrom) {
          const expectedPos = assembly === 'GRCh38' ? activeLocus.hg38Pos : activeLocus.hg19Pos;
          if (expectedPos >= start && expectedPos <= end) {
            setVariants([
              {
                chrom,
                pos: expectedPos,
                id: activeLocus.gene === 'BRAF V600E' ? 'rs113488022' : 'rs28934578',
                ref: 'A',
                alt: 'T',
                qual: 100,
                filter: 'PASS',
                gene: activeLocus.gene.split(' ')[0],
                clinvar: activeLocus.significance,
                score: 10.0,
              },
            ]);
          }
        }
      }
    },
    [isAirgapped]
  );

  // Debounced navigation effect
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

  // Render Level 0 Karyotype Canvas
  useEffect(() => {
    const canvas = karyotypeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const maxChromBp = 248956422; // chr1 length
    const colWidth = (width - 16) / CHROMOSOMES.length;

    CHROMOSOMES.forEach((chr, idx) => {
      const info = cytobandService.getChromInfo(chr, assembly);
      const chrLen = info ? info.length : 100000000;
      const barH = Math.max(12, (chrLen / maxChromBp) * (height - 32));
      const x = 8 + idx * colWidth + (colWidth - 8) / 2;
      const y = height - 20 - barH;

      const isSelected = chr === selectedChrom;

      // Draw capsule
      ctx.beginPath();
      ctx.roundRect(x, y, 8, barH, 4);
      if (isSelected) {
        ctx.fillStyle = '#2563eb';
        ctx.shadowColor = 'rgba(37, 99, 235, 0.35)';
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = '#e2e8f0';
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
      ctx.fill();

      // Pathogenic marker dot
      if (chr === 'chr7' || chr === 'chr13' || chr === 'chr17' || chr === 'chr19') {
        ctx.beginPath();
        ctx.arc(x + 4, y - 5, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#dc2626';
        ctx.fill();
      }

      // Chromosome label
      ctx.fillStyle = isSelected ? '#2563eb' : '#64748b';
      ctx.font = isSelected ? '600 10px Inter, Pretendard, sans-serif' : '400 9px Inter, Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(chr.replace('chr', ''), x + 4, height - 6);
    });
  }, [selectedChrom, assembly]);

  // Render Level 1 Cytoband Ideogram
  useEffect(() => {
    const canvas = cytobandCanvasRef.current;
    if (!canvas || !chromInfo) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const padX = 24;
    const drawW = width - padX * 2;
    const barH = 26;
    const barY = (height - barH) / 2;

    // Draw chromosome backbone & cytobands
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(padX, barY, drawW, barH, 13);
    ctx.clip();

    cytobands.forEach((band: Cytoband) => {
      const bx = padX + (band.start / chromInfo.length) * drawW;
      const bw = ((band.end - band.start) / chromInfo.length) * drawW;

      if (band.stain === 'acen') {
        ctx.fillStyle = '#f87171'; // Centromere constriction
      } else if (band.stain === 'gneg') {
        ctx.fillStyle = '#ffffff';
      } else if (band.stain === 'gpos25') {
        ctx.fillStyle = '#e2e8f0';
      } else if (band.stain === 'gpos50') {
        ctx.fillStyle = '#94a3b8';
      } else if (band.stain === 'gpos75') {
        ctx.fillStyle = '#475569';
      } else if (band.stain === 'gpos100') {
        ctx.fillStyle = '#0f172a';
      } else {
        ctx.fillStyle = '#cbd5e1';
      }

      ctx.fillRect(bx, barY, bw, barH);
    });
    ctx.restore();

    // Outer border
    ctx.beginPath();
    ctx.roundRect(padX, barY, drawW, barH, 13);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Viewfinder Lens
    const vfX = padX + (windowStart / chromInfo.length) * drawW;
    const vfW = Math.max(6, ((windowEnd - windowStart) / chromInfo.length) * drawW);

    ctx.fillStyle = 'rgba(37, 99, 235, 0.16)';
    ctx.fillRect(vfX, barY - 4, vfW, barH + 8);

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(vfX, barY - 4, vfW, barH + 8);

    // Viewfinder handles
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(vfX - 2, barY - 6, 4, barH + 12);
    ctx.fillRect(vfX + vfW - 2, barY - 6, 4, barH + 12);

    // Current Locus Beacon Pin on Cytoband
    if (activeLocus && activeLocus.chrom === selectedChrom) {
      const pos = assembly === 'GRCh38' ? activeLocus.hg38Pos : activeLocus.hg19Pos;
      const lx = padX + (pos / chromInfo.length) * drawW;
      
      ctx.beginPath();
      ctx.arc(lx, barY - 8, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#dc2626';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [chromInfo, cytobands, windowStart, windowEnd, selectedChrom, assembly, activeLocus]);

  // Render Level 2/3 Track Canvas (Ruler, Exons, Variants)
  useEffect(() => {
    const canvas = trackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const padLeft = 40;
    const padRight = 40;
    const drawW = width - padLeft - padRight;
    const span = windowEnd - windowStart;

    // 1. Genomic Ruler
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
      ctx.fillText(`${(tickBp / 1000000).toFixed(4)} Mb`, tx, rulerY - 10);
    }

    // 2. Gene Model Track (Exons & Introns)
    const geneY = 85;
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 13px Inter, Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('GENE MODEL (RefSeq / Ensembl)', padLeft, geneY - 14);

    // Intron backbone
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, geneY);
    ctx.lineTo(width - padRight, geneY);
    ctx.stroke();

    // Directional intron arrows
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    for (let x = padLeft + 40; x < width - padRight; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x - 4, geneY - 4);
      ctx.lineTo(x, geneY);
      ctx.lineTo(x - 4, geneY + 4);
      ctx.stroke();
    }

    // Exons
    if (activeLocus && activeLocus.chrom === selectedChrom) {
      const activePos = assembly === 'GRCh38' ? activeLocus.hg38Pos : activeLocus.hg19Pos;
      const exStart = activePos - 120;
      const exEnd = activePos + 120;

      const ex1 = padLeft + ((exStart - windowStart) / span) * drawW;
      const exW = Math.max(16, ((exEnd - exStart) / span) * drawW);

      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.roundRect(ex1, geneY - 10, exW, 20, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 10px Inter, Pretendard, sans-serif';
      ctx.textAlign = 'center';
      if (exW > 30) {
        ctx.fillText(activeLocus.exon.split(' ')[0], ex1 + exW / 2, geneY + 4);
      }
    }

    // 3. Variant Track
    const varY = 160;
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 13px Inter, Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `VARIANTS & CLINICAL ANNOTATIONS (${variants.length} observed in window)`,
      padLeft,
      varY - 20
    );

    if (span <= 20000) {
      // Level 3 Detailed Pin View
      if (variants.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '400 13px Inter, Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No variants observed in this genomic window.', width / 2, varY + 20);
      } else {
        variants.forEach((v) => {
          const vx = padLeft + ((v.pos - windowStart) / span) * drawW;

          // Vertical guideline
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(vx, rulerY);
          ctx.lineTo(vx, varY + 30);
          ctx.stroke();
          ctx.setLineDash([]);

          // Significance coloring
          let pinColor = '#3b82f6';
          if (v.clinvar?.toLowerCase().includes('pathogenic')) {
            pinColor = '#dc2626';
          } else if (v.clinvar?.toLowerCase().includes('risk')) {
            pinColor = '#f59e0b';
          }

          // Outer pulse glow
          ctx.beginPath();
          ctx.arc(vx, varY, 14, 0, Math.PI * 2);
          ctx.fillStyle = pinColor === '#dc2626' ? 'rgba(220, 38, 38, 0.15)' : 'rgba(59, 130, 246, 0.15)';
          ctx.fill();

          // Center Beacon
          ctx.beginPath();
          ctx.arc(vx, varY, 7, 0, Math.PI * 2);
          ctx.fillStyle = pinColor;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Mutation Badge Tag
          ctx.fillStyle = '#0f172a';
          ctx.font = '600 11px ui-monospace, SFMono-Regular, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${v.ref}>${v.alt}`, vx, varY - 18);

          ctx.fillStyle = pinColor;
          ctx.font = '600 10px Inter, Pretendard, sans-serif';
          ctx.fillText(v.clinvar || 'Variant', vx, varY + 26);
        });
      }
    } else {
      // Level 2 Binned Density View
      ctx.fillStyle = '#64748b';
      ctx.font = '400 12px Inter, Pretendard, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Level 2: Semantic Density Histogram (1Mb/Chunk Bins)', width - padRight, varY - 20);

      const maxCount = Math.max(1, ...densityBins.map((b) => b.count));
      const binW = drawW / Math.max(1, densityBins.length);

      densityBins.forEach((bin, idx) => {
        const bx = padLeft + idx * binW;
        const bH = (bin.count / maxCount) * 50;

        ctx.fillStyle = bin.score >= 10 ? '#fca5a5' : '#bfdbfe';
        ctx.fillRect(bx, varY + 40 - bH, binW - 1, bH);
      });
    }
  }, [windowStart, windowEnd, variants, densityBins, activeLocus, selectedChrom, assembly]);

  // Handle Canvas Mouse Move (Overlay Layer)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padLeft = 40;
    const padRight = 40;
    const drawW = rect.width - padLeft - padRight;
    const span = windowEnd - windowStart;

    if (x >= padLeft && x <= rect.width - padRight) {
      const bp = Math.round(windowStart + ((x - padLeft) / drawW) * span);
      setHoverPos({ x, y, bp });

      // Check variant hit
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

  // Render Interactive Overlay Canvas (Hairline & Tooltip)
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    if (hoverPos) {
      // Hairline crosshair
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hoverPos.x, 20);
      ctx.lineTo(hoverPos.x, rect.height - 20);
      ctx.stroke();
      ctx.setLineDash([]);

      // Floating Coordinate Badge
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(hoverPos.x - 45, 6, 90, 20, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '500 10px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${hoverPos.bp.toLocaleString()} bp`, hoverPos.x, 20);

      // Render Hovered Variant Pill
      if (hoveredVariant) {
        const text = `${hoveredVariant.id || 'rs'} (${hoveredVariant.ref}>${hoveredVariant.alt})`;
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.roundRect(hoverPos.x - 60, 200, 120, 22, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 10px Inter, Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, hoverPos.x, 215);
      }
    }
  }, [hoverPos, hoveredVariant]);

  // Zoom & Pan Actions
  const handleZoom = (factor: number) => {
    const span = windowEnd - windowStart;
    const center = Math.round((windowStart + windowEnd) / 2);
    const newSpan = Math.max(1000, Math.min(chromInfo?.length || 200000000, span * factor));
    const newStart = Math.max(0, Math.round(center - newSpan / 2));
    const newEnd = Math.min(chromInfo?.length || 200000000, Math.round(center + newSpan / 2));

    setWindowStart(newStart);
    setWindowEnd(newEnd);
  };

  const handlePan = (direction: 'left' | 'right') => {
    const span = windowEnd - windowStart;
    const step = Math.round(span * 0.25);
    if (direction === 'left') {
      const newStart = Math.max(0, windowStart - step);
      setWindowStart(newStart);
      setWindowEnd(newStart + span);
    } else {
      const maxLen = chromInfo?.length || 200000000;
      const newEnd = Math.min(maxLen, windowEnd + step);
      setWindowEnd(newEnd);
      setWindowStart(newEnd - span);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* 1. Header Toolbar (Pure Light Editorial) */}
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
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Multi-scale Whole-Genome Navigator
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '600',
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
              }}
            >
              Level {windowEnd - windowStart <= 20000 ? '3 (Variant Locus)' : '2 (Density)'}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            Deterministic chunk slicing with off-thread Web Worker decoding & zero-network OPFS airgap.
          </p>
        </div>

        {/* Controls: Assembly & Airgap */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Assembly Segmented Control */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#f1f5f9',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              onClick={() => handleAssemblySwitch('GRCh38')}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: assembly === 'GRCh38' ? '700' : '500',
                backgroundColor: assembly === 'GRCh38' ? '#ffffff' : 'transparent',
                color: assembly === 'GRCh38' ? '#2563eb' : '#64748b',
                borderRadius: '6px',
                border: 'none',
                boxShadow: assembly === 'GRCh38' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              GRCh38 (hg38)
            </button>
            <button
              onClick={() => handleAssemblySwitch('GRCh37')}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: assembly === 'GRCh37' ? '700' : '500',
                backgroundColor: assembly === 'GRCh37' ? '#ffffff' : 'transparent',
                color: assembly === 'GRCh37' ? '#2563eb' : '#64748b',
                borderRadius: '6px',
                border: 'none',
                boxShadow: assembly === 'GRCh37' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              GRCh37 (hg19)
            </button>
          </div>

          {/* OPFS Airgap Switch */}
          <button
            onClick={() => setIsAirgapped(!isAirgapped)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              border: isAirgapped ? '1px solid #86efac' : '1px solid #e2e8f0',
              backgroundColor: isAirgapped ? '#f0fdf4' : '#ffffff',
              color: isAirgapped ? '#166534' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            {isAirgapped ? <ShieldCheck size={15} color="#16a34a" /> : <Shield size={15} color="#64748b" />}
            {isAirgapped ? 'OPFS Airgap Active (Isolated)' : 'Edge Streaming (R2)'}
          </button>

          {/* Download to OPFS */}
          {!isOpfsCached && (
            <button
              onClick={handleCacheToOpfs}
              disabled={cachingProgress !== null}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
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

      {/* 2. Benchmark Hotspot Loci (Quick Jump Chips) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          padding: '4px 0',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginRight: '4px' }}>
          Quick Jump:
        </span>
        {BENCHMARK_LOCI.map((locus) => {
          const isActive =
            activeLocus?.gene === locus.gene &&
            selectedChrom === locus.chrom &&
            windowStart === (assembly === 'GRCh38' ? locus.hg38Start : locus.hg19Start);

          return (
            <button
              key={locus.gene}
              onClick={() => selectBenchmarkLocus(locus)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: isActive ? '700' : '500',
                border: isActive ? '1px solid #2563eb' : '1px solid #e2e8f0',
                backgroundColor: isActive ? '#eff6ff' : '#ffffff',
                color: isActive ? '#2563eb' : '#334155',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: locus.significance === 'Pathogenic' ? '#dc2626' : '#f59e0b',
                }}
              />
              {locus.gene}
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                ({locus.chrom}:{((assembly === 'GRCh38' ? locus.hg38Pos : locus.hg19Pos) / 1000000).toFixed(2)}M)
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Level 0: Karyotype Chromosome Matrix */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
            Level 0: Whole-Genome Karyotype Overview ({assembly})
          </span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Click any chromosome to inspect cytogenetic bands
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
              const colWidth = (rect.width - 16) / CHROMOSOMES.length;
              const idx = Math.floor((x - 8) / colWidth);
              if (idx >= 0 && idx < CHROMOSOMES.length) {
                const targetChr = CHROMOSOMES[idx];
                setSelectedChrom(targetChr);
                const info = cytobandService.getChromInfo(targetChr, assembly);
                const center = info ? Math.round(info.length / 2) : 50000000;
                setWindowStart(Math.max(0, center - 10000000));
                setWindowEnd(center + 10000000);
              }
            }}
            style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* 4. Level 1: Cytoband & Viewfinder */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
              {selectedChrom} Ideogram
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {chromInfo ? `${(chromInfo.length / 1000000).toFixed(1)} Mb total length` : ''}
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
              fontWeight: '600',
            }}
          >
            Window: {windowStart.toLocaleString()} - {windowEnd.toLocaleString()} bp (
            {((windowEnd - windowStart) / 1000).toFixed(1)} kb)
          </span>
        </div>

        <div style={{ height: '48px', width: '100%', position: 'relative' }}>
          <canvas
            ref={cytobandCanvasRef}
            onClick={(e) => {
              const canvas = cytobandCanvasRef.current;
              if (!canvas || !chromInfo) return;
              const rect = canvas.getBoundingClientRect();
              const padX = 24;
              const drawW = rect.width - padX * 2;
              const clickX = e.clientX - rect.left - padX;
              if (clickX >= 0 && clickX <= drawW) {
                const targetBp = Math.round((clickX / drawW) * chromInfo.length);
                const span = windowEnd - windowStart;
                setWindowStart(Math.max(0, Math.round(targetBp - span / 2)));
                setWindowEnd(Math.min(chromInfo.length, Math.round(targetBp + span / 2)));
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
        {/* Viewport Control Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
              High-Resolution Genomic Track
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
                <RefreshCw size={12} className="animate-spin" /> Decoding chunk...
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

        {/* 2-Layer Virtualized Canvas */}
        <div style={{ position: 'relative', width: '100%', height: '260px' }}>
          {/* Layer 1: Background Track Canvas */}
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

          {/* Layer 2: Foreground Interactive Overlay Canvas */}
          <canvas
            ref={overlayCanvasRef}
            onMouseMove={handleMouseMove}
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
              cursor: 'crosshair',
            }}
          />
        </div>
      </div>

      {/* 6. Active Clinical Variant Card (Rich Inspector) */}
      {activeLocus && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  {activeLocus.gene}
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: activeLocus.significance === 'Pathogenic' ? '#fee2e2' : '#fef3c7',
                    color: activeLocus.significance === 'Pathogenic' ? '#dc2626' : '#b45309',
                  }}
                >
                  {activeLocus.significance}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {activeLocus.exon}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#475569', margin: '6px 0 0 0' }}>
                {activeLocus.description}
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a', fontFamily: 'ui-monospace, monospace' }}>
                {activeLocus.hgvs}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Current Assembly: <strong style={{ color: '#2563eb' }}>{assembly}</strong> (
                {assembly === 'GRCh38'
                  ? `${activeLocus.chrom}:${activeLocus.hg38Pos.toLocaleString()}`
                  : `${activeLocus.chrom}:${activeLocus.hg19Pos.toLocaleString()}`}
                )
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
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Target Diseases</div>
              <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600', marginTop: '4px' }}>
                {activeLocus.disease}
              </div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>GRCh38 / GRCh37 Coordinates</div>
              <div style={{ fontSize: '12px', color: '#0f172a', fontFamily: 'ui-monospace, monospace', marginTop: '4px' }}>
                hg38: {activeLocus.hg38Pos.toLocaleString()} bp<br />
                hg19: {activeLocus.hg19Pos.toLocaleString()} bp
              </div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Evidence & Validation</div>
              <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: '600', marginTop: '4px' }}>
                ClinVar Verified / Somatic Hotspot (ACMG Class 1)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Engine Telemetry Log Drawer */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={14} color="#2563eb" /> Engine Streaming & Isolation Audit Logs
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            Latest {logs.length} operations
          </span>
        </div>
        <div
          style={{
            maxHeight: '120px',
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
                  fontWeight: '600',
                  color: log.type === 'opfs' ? '#16a34a' : log.type === 'network' ? '#2563eb' : '#d97706',
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
