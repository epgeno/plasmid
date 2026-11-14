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
import { SupportedLanguage, TRANSLATIONS } from '../i18n';
import type {
  AnnotationRecord,
  CatalogVariantItem,
  ChromosomeOverview,
  DataSourceMode,
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

function localizeRangeLabel(label: string, lang: SupportedLanguage): string {
  if (lang === 'en') return label;
  const map: Record<string, Record<'ko' | 'zh' | 'ja', string>> = {
    'Header 128B': { ko: '헤더 128B', zh: '头部 128B', ja: 'ヘッダー 128B' },
    'Root Directory': { ko: '루트 디렉터리', zh: '根目录', ja: 'ルートディレクトリ' },
    'Flat Directory': { ko: '플랫 디렉터리', zh: '平面目录', ja: 'フラットディレクトリ' },
    'Container Metadata': { ko: '컨테이너 메타데이터', zh: '容器元数据', ja: 'コンテナメタデータ' },
    'Vault VCF': { ko: '볼트 VCF', zh: '保险库 VCF', ja: '保管庫 VCF' },
    'Vault .plasmid': { ko: '볼트 .plasmid', zh: '保险库 .plasmid', ja: '保管庫 .plasmid' },
  };
  if (map[label]) return map[label][lang];
  const leafMatch = /^Leaf Dir \((.+)\)$/.exec(label);
  if (leafMatch) {
    if (lang === 'ko') return `리프 디렉터리 (${leafMatch[1]})`;
    if (lang === 'zh') return `叶目录 (${leafMatch[1]})`;
    return `リーフディレクトリ (${leafMatch[1]})`;
  }
  const chunkMatch = /^Chunks? #(.+)$/.exec(label);
  if (chunkMatch) {
    if (lang === 'ko') return `청크 #${chunkMatch[1]}`;
    if (lang === 'zh') return `数据块 #${chunkMatch[1]}`;
    return `チャンク #${chunkMatch[1]}`;
  }
  return label;
}

function localizeAuditTypeBadge(type: AuditLogType, lang: SupportedLanguage): string {
  if (type === 'opfs') return 'OPFS';
  if (lang === 'ko') return type === 'network' ? '네트워크' : 'WASM';
  if (lang === 'zh') return type === 'network' ? '网络' : 'WASM';
  if (lang === 'ja') return type === 'network' ? '通信' : 'WASM';
  return type.toUpperCase();
}

function localizeAuditMessage(message: string, lang: SupportedLanguage): string {
  if (lang === 'en') return message;

  let m = /^Found (.+) in OPFS\. Engaged offline Airgap slicing\.$/.exec(message);
  if (m) {
    if (lang === 'ko') return `OPFS에서 ${m[1]} 확인됨 — 오프라인 에어갭 슬라이싱 활성화`;
    if (lang === 'zh') return `已在 OPFS 中找到 ${m[1]} — 已启用离线空气隔离切片`;
    return `OPFS 内に ${m[1]} を検出 — オフラインエアギャップスライシング有効化`;
  }

  m = /^Downloading (.+) into browser OPFS sandbox\.\.\.$/.exec(message);
  if (m) {
    if (lang === 'ko') return `브라우저 OPFS 격리 저장소로 ${m[1]} 다운로드 중...`;
    if (lang === 'zh') return `正在将 ${m[1]} 下载至浏览器 OPFS 沙箱...`;
    return `${m[1]} をブラウザ OPFS サンドボックスへ保存中...`;
  }

  m = /^(.+) cached in OPFS\. Zero-network Airgap slicing engaged\.$/.exec(message);
  if (m) {
    if (lang === 'ko') return `${m[1]} OPFS 저장 완료 — 무네트워크 에어갭 슬라이싱 전환`;
    if (lang === 'zh') return `${m[1]} 已缓存至 OPFS — 已切换至零网络空气隔离切片`;
    return `${m[1]} を OPFS に保存完了 — ゼロ通信エアギャップスライシングへ切替`;
  }

  m = /^HTTP 206 \[(.+)\] (.+) \((.+) B\)$/.exec(message);
  if (m) {
    return `HTTP 206 [${localizeRangeLabel(m[1], lang)}] ${m[2]} (${m[3]} B)`;
  }

  m = /^HTTP 200 \[(.+)\] sliced (.+) \((.+) B of (.+) B\)$/.exec(message);
  if (m) {
    return `HTTP 200 [${localizeRangeLabel(m[1], lang)}] ${m[2]} (${m[3]} B / ${m[4]} B)`;
  }

  m = /^OPFS \[(.+)\] (.+) \((.+) B\)$/.exec(message);
  if (m) {
    return `OPFS [${localizeRangeLabel(m[1], lang)}] ${m[2]} (${m[3]} B)`;
  }

  m = /^WASM parsed \.plasmid v(\d+) \((.+), (2-stage hierarchical|flat) index, (\d+) chunks, root=(.+)\)$/.exec(message);
  if (m) {
    const idxKind =
      m[3] === '2-stage hierarchical'
        ? lang === 'ko'
          ? '2단계 계층형 색인'
          : lang === 'zh'
            ? '二级分层索引'
            : '2段階階層索引'
        : lang === 'ko'
          ? '플랫 색인'
          : lang === 'zh'
            ? '平面索引'
            : 'フラット索引';
    if (lang === 'ko')
      return `WASM 헤더 파싱 완료: .plasmid v${m[1]} (${m[2]}, ${idxKind}, 청크 ${m[4]}개, 루트=${m[5]})`;
    if (lang === 'zh')
      return `WASM 已解析 .plasmid v${m[1]} (${m[2]}，${idxKind}，${m[4]} 个块，根=${m[5]})`;
    return `WASM ヘッダー解析完了: .plasmid v${m[1]} (${m[2]}, ${idxKind}, ${m[4]} チャンク, ルート=${m[5]})`;
  }

  m = /^Chunk cache hit for #(.+) \(0 network bytes\)$/.exec(message);
  if (m) {
    if (lang === 'ko') return `청크 캐시 적중 #${m[1]} (추가 네트워크 전송 0 B)`;
    if (lang === 'zh') return `数据块缓存命中 #${m[1]}（网络传输 0 B）`;
    return `チャンクキャッシュ一致 #${m[1]} (通信量 0 B)`;
  }

  m = /^WASM decoded (\d+) variant\(s\), (\d+) note\(s\), SHA-256 verified (\d+) chunk\(s\)$/.exec(message);
  if (m) {
    if (lang === 'ko')
      return `WASM 디코딩 완료: 변이 ${m[1]}건, 주석 ${m[2]}건, SHA-256 검증 청크 ${m[3]}개`;
    if (lang === 'zh')
      return `WASM 解码完成：变异 ${m[1]} 项，注释 ${m[2]} 项，SHA-256 校验 ${m[3]} 个块`;
    return `WASM デコード完了: 変異 ${m[1]} 件, 注釈 ${m[2]} 件, SHA-256 検証 ${m[3]} チャンク`;
  }

  m = /^Jumped to indexed locus (.+) on (.+)$/.exec(message);
  if (m) {
    if (lang === 'ko') return `색인 구간 이동: ${m[2]} • ${m[1]}`;
    if (lang === 'zh') return `已跳转至索引位点：${m[2]} • ${m[1]}`;
    return `索引座位へ移動: ${m[2]} • ${m[1]}`;
  }

  m = /^Leaf directory queried: no overlapping blocks in (.+)$/.exec(message);
  if (m) {
    if (lang === 'ko') return `리프 디렉터리 조회 완료: ${m[1]} 구간에 겹치는 블록 없음`;
    if (lang === 'zh') return `叶目录查询完成：${m[1]} 区间无重叠数据块`;
    return `リーフディレクトリ照会完了: ${m[1]} に重複ブロックなし`;
  }

  m = /^Root directory miss on (.+) \(0 leaf\/chunk bytes needed\)$/.exec(message);
  if (m) {
    if (lang === 'ko') return `루트 디렉터리 미포함 구간: ${m[1]} (리프/청크 요청 0 B)`;
    if (lang === 'zh') return `根目录未命中区间：${m[1]}（无需读取叶/数据块 0 B）`;
    return `ルートディレクトリ対象外区間: ${m[1]} (追加取得 0 B)`;
  }

  m = /^WASM Liftover translated (.+) \((.+)\) -> (.+) \((.+)\)$/.exec(message);
  if (m) {
    if (lang === 'ko') return `WASM 좌표 변환: ${m[1]} (${m[2]}) → ${m[3]} (${m[4]})`;
    if (lang === 'zh') return `WASM 坐标转换：${m[1]} (${m[2]}) → ${m[3]} (${m[4]})`;
    return `WASM 座標変換: ${m[1]} (${m[2]}) → ${m[3]} (${m[4]})`;
  }

  m = /^WASM Liftover \((.+) -> (.+)\): (.+) -> (.+)$/.exec(message);
  if (m) {
    if (lang === 'ko') return `WASM 구간 보정 (${m[1]} → ${m[2]}): ${m[3]} → ${m[4]}`;
    if (lang === 'zh') return `WASM 窗口换算 (${m[1]} → ${m[2]})：${m[3]} → ${m[4]}`;
    return `WASM 区間変換 (${m[1]} → ${m[2]}): ${m[3]} → ${m[4]}`;
  }

  m = /^Liftover unmapped for (.+) \((.+)\): (.+)$/.exec(message);
  if (m) {
    if (lang === 'ko') return `좌표 변환 매핑 범위 밖: ${m[1]} (${m[2]})`;
    if (lang === 'zh') return `坐标转换超出映射范围：${m[1]} (${m[2]})`;
    return `座標変換範囲外: ${m[1]} (${m[2]})`;
  }

  m = /^Switched assembly to (.+) \((.+) unmapped: (.+)\)$/.exec(message);
  if (m) {
    if (lang === 'ko') return `기준 유전체 ${m[1]} 전환 (${m[2]} 매핑 범위 밖)`;
    if (lang === 'zh') return `已切换参考基因组至 ${m[1]}（${m[2]} 未映射）`;
    return `参照ゲノムを ${m[1]} に切替 (${m[2]} 未マップ)`;
  }

  m = /^Slice error: (.+)$/.exec(message);
  if (m) {
    if (lang === 'ko') return `슬라이스 오류: ${m[1]}`;
    if (lang === 'zh') return `切片错误：${m[1]}`;
    return `スライスエラー: ${m[1]}`;
  }

  m = /^OPFS cache error: (.+)$/.exec(message);
  if (m) {
    if (lang === 'ko') return `OPFS 저장 오류: ${m[1]}`;
    if (lang === 'zh') return `OPFS 缓存错误：${m[1]}`;
    return `OPFS 保存エラー: ${m[1]}`;
  }

  m = /^WASM parsed local VCF \((.+), (\d+) variants across (\d+) chromosomes, sha256=(.+)\)$/.exec(
    message
  );
  if (m) {
    if (lang === 'ko')
      return `WASM 로컬 VCF 파싱 완료: ${m[1]} (염색체 ${m[3]}개 내 변이 ${m[2]}건, sha256=${m[4]})`;
    if (lang === 'zh')
      return `WASM 已解析本地 VCF：${m[1]}（${m[3]} 条染色体共 ${m[2]} 个变异，sha256=${m[4]}）`;
    return `WASM ローカル VCF 解析完了: ${m[1]} (${m[3]} 染色体・変異 ${m[2]} 件, sha256=${m[4]})`;
  }

  m = /^Vault VCF coordinate index miss on (.+) \(0 network bytes\)$/.exec(message);
  if (m) {
    if (lang === 'ko') return `로컬 볼트 색인 구간 밖: ${m[1]} (네트워크 전송 0 B)`;
    if (lang === 'zh') return `本地保险库索引未命中：${m[1]}（网络传输 0 B）`;
    return `ローカル保管庫索引対象外: ${m[1]} (通信量 0 B)`;
  }

  m = /^OPFS Vault sliced (\d+) variant\(s\) on (.+) \(0 network bytes\)$/.exec(message);
  if (m) {
    if (lang === 'ko') return `OPFS 볼트 조회 완료: ${m[2]} 변이 ${m[1]}건 (네트워크 전송 0 B)`;
    if (lang === 'zh') return `OPFS 保险库切片完成：${m[2]} 变异 ${m[1]} 项（网络传输 0 B）`;
    return `OPFS 保管庫スライス完了: ${m[2]} 変異 ${m[1]} 件 (通信量 0 B)`;
  }

  return message;
}

export interface GenomeNavigatorProps {
  lang?: SupportedLanguage;
  sourceMode?: DataSourceMode;
  opfsFilename?: string;
  containerAssembly?: GenomeAssembly;
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
  lang = 'ko',
  sourceMode = 'public',
  opfsFilename = DEFAULT_OPFS_FILENAME,
  containerAssembly = 'GRCh38',
  catalogItems = [],
  selectedCatalogKey,
  onSelectCatalogKey,
}) => {
  const nt = TRANSLATIONS[lang].navigator;
  const isVaultSource = sourceMode === 'vault';

  const [assembly, setAssembly] = useState<GenomeAssembly>(containerAssembly);
  const [selectedChrom, setSelectedChrom] = useState<string>('chr7');
  const [windowStart, setWindowStart] = useState<number>(140750000);
  const [windowEnd, setWindowEnd] = useState<number>(140756000);

  const [isPublicAirgapped, setIsPublicAirgapped] = useState<boolean>(false);
  const [isOpfsCached, setIsOpfsCached] = useState<boolean>(false);
  const [cachingProgress, setCachingProgress] = useState<number | null>(null);
  const effectiveAirgapped = isVaultSource ? true : isPublicAirgapped;

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
  const [viewportEpoch, setViewportEpoch] = useState<number>(0);

  const containerRootRef = useRef<HTMLDivElement | null>(null);
  const trackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overviewBarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const karyotypeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assemblyRef = useRef<GenomeAssembly>(containerAssembly);

  // Redraw all 4 canvases cleanly whenever container or viewport width changes
  useEffect(() => {
    const el = containerRootRef.current;
    const bump = () => setViewportEpoch((n) => n + 1);
    window.addEventListener('resize', bump);
    let observer: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => bump());
      observer.observe(el);
    }
    return () => {
      window.removeEventListener('resize', bump);
      observer?.disconnect();
    };
  }, []);

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

  // Sync viewing assembly when active container/vault assembly changes
  useEffect(() => {
    assemblyRef.current = containerAssembly;
    setAssembly(containerAssembly);
  }, [containerAssembly, opfsFilename]);

  // Check OPFS cache state for public demo container on mount
  useEffect(() => {
    if (isVaultSource) return;
    opfs.hasFile(DEFAULT_OPFS_FILENAME).then((cached: boolean) => {
      setIsOpfsCached(cached);
      if (cached) {
        opfs.setAirgapped(true);
        setIsPublicAirgapped(true);
        addLog(
          `Found ${DEFAULT_OPFS_FILENAME} in OPFS. Engaged offline Airgap slicing.`,
          'opfs'
        );
      }
    });
  }, [addLog, isVaultSource]);

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

    let cancelled = false;
    const targetChrom = found.variant.chrom;
    const viewAsm = assemblyRef.current;

    const applyJump = async () => {
      let targetPos = found.variant.pos;
      if (viewAsm !== containerAssembly) {
        const dir =
          containerAssembly === 'GRCh38' && viewAsm === 'GRCh37'
            ? 'hg38_to_hg19'
            : 'hg19_to_hg38';
        try {
          const lifted = await decoderClient.liftoverCoordinate(
            dir,
            targetChrom,
            found.variant.pos,
            found.variant.ref
          );
          targetPos = lifted.lifted_pos;
        } catch {
          // Keep source coordinate if unmapped
        }
      }
      if (cancelled) return;
      setSelectedChrom(targetChrom);
      setWindowStart(Math.max(1, targetPos - 3000));
      setWindowEnd(targetPos + 3000);
      setSelectedVariantPos(targetPos);
    };
    void applyJump();
    return () => {
      cancelled = true;
    };
  }, [selectedCatalogKey, catalogItems, containerAssembly, opfsFilename]);

  const activeChromosomesMap = useMemo(() => {
    const map = new Map<string, ChromosomeOverview>();
    const normalizeBuild = (b: string): GenomeAssembly => {
      const upper = b.toUpperCase();
      return upper.includes('37') || upper.includes('19') ? 'GRCh37' : 'GRCh38';
    };
    const baseSource =
      containerPyramid && normalizeBuild(containerPyramid.build) === assembly
        ? containerPyramid
        : assemblyPyramid;

    if (baseSource) {
      for (const c of baseSource.chromosomes) {
        const containerChr = containerPyramid?.chromosomes.find(
          (cc) => cc.chrom_name === c.chrom_name
        );
        map.set(c.chrom_name, {
          ...c,
          total_variants: containerChr?.total_variants ?? c.total_variants,
          pathogenic_count: containerChr?.pathogenic_count ?? c.pathogenic_count,
          bins: c.bins,
          max_score: c.max_score,
        });
      }
    }
    return map;
  }, [assembly, assemblyPyramid, containerPyramid]);

  const currentChromOverview = useMemo(() => {
    return activeChromosomesMap.get(selectedChrom) ?? null;
  }, [activeChromosomesMap, selectedChrom]);

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
      label: `${leaf.chrom_name} (${leaf.entry_count})`,
      chrom: leaf.chrom_name,
      pos: leaf.max_pos,
      windowStart: Math.max(1, leaf.max_pos - 3000),
      windowEnd: leaf.max_pos + 3000,
    }));
  }, [catalogItems, lastQueryResult]);

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
      assemblyRef.current = newAssembly;
      setAssembly(newAssembly);
      setWindowStart(newStart);
      setWindowEnd(newEnd);
      addLog(
        `WASM Liftover translated ${selectedChrom}:${midpoint.toLocaleString()} (${assembly}) -> ${lifted.lifted_pos.toLocaleString()} (${newAssembly})`,
        'worker'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      assemblyRef.current = newAssembly;
      setAssembly(newAssembly);
      addLog(
        `Switched assembly to ${newAssembly} (${selectedChrom}:${midpoint.toLocaleString()} unmapped: ${msg})`,
        'worker'
      );
    }
  };

  const handleJumpToChip = async (chip: IndexedHotspotChip) => {
    let targetPos = chip.pos;
    if (assembly !== containerAssembly) {
      const dir =
        containerAssembly === 'GRCh38' && assembly === 'GRCh37'
          ? 'hg38_to_hg19'
          : 'hg19_to_hg38';
      try {
        const lifted = await decoderClient.liftoverCoordinate(
          dir,
          chip.chrom,
          chip.pos,
          'N'
        );
        targetPos = lifted.lifted_pos;
      } catch {
        // Keep source coordinate if unmapped
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
      opfs.setAirgapped(true);
      setIsOpfsCached(true);
      setIsPublicAirgapped(true);
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
          sourceMode,
          airgapped: effectiveAirgapped,
          opfsFilename,
          signal: controller.signal,
          onLog: addLog,
        });
        if (controller.signal.aborted) return;

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
          if (controller.signal.aborted) return;
          setDensityBins(bins);
        } else {
          setDensityBins([]);
        }

        setIsLoading(false);
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          return;
        }
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
        addLog(`Slice error: ${message}`, effectiveAirgapped ? 'opfs' : 'network');
      }
    },
    [sourceMode, effectiveAirgapped, opfsFilename, addLog]
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

  // Render Level 0 Karyotype Canvas
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
    const padOuter = width < 420 ? 4 : 8;
    const colWidth = (width - padOuter * 2) / ORDERED_CHROMOSOMES.length;
    const barW = Math.min(8, Math.max(4, Math.floor(colWidth - 4)));

    ORDERED_CHROMOSOMES.forEach((chr, idx) => {
      const overview = activeChromosomesMap.get(chr);
      const chrLen = overview?.length ?? 100_000_000;
      const barH = Math.max(12, (chrLen / maxChromBp) * (height - 32));
      const x = padOuter + idx * colWidth + (colWidth - barW) / 2;
      const y = height - 20 - barH;
      const isSelected = chr === selectedChrom;

      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, barW / 2);
      ctx.fillStyle = isSelected ? '#2563eb' : '#e2e8f0';
      ctx.fill();

      if (overview && overview.max_score > 0) {
        overview.bins.forEach((binScore, binIdx) => {
          if (binScore <= 0) return;
          const relY = y + ((binIdx * 1_000_000) / Math.max(1, chrLen)) * barH;
          ctx.fillStyle = isSelected
            ? '#ffffff'
            : binScore >= 10
              ? '#dc2626'
              : '#d97706';
          ctx.fillRect(x + 1, Math.min(y + barH - 2, relY), Math.max(2, barW - 2), 2);
        });
      }

      if (overview && overview.total_variants > 0) {
        ctx.beginPath();
        ctx.arc(x + barW / 2, y - 5, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = overview.pathogenic_count > 0 ? '#dc2626' : '#f59e0b';
        ctx.fill();
      }

      const fontSize = width < 420 ? 8 : isSelected ? 10 : 9;
      ctx.fillStyle = isSelected ? '#2563eb' : '#64748b';
      ctx.font = `${isSelected ? 600 : 400} ${fontSize}px Inter, Pretendard, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(chr.replace('chr', ''), x + barW / 2, height - 6);
    });
  }, [selectedChrom, activeChromosomesMap, viewportEpoch]);

  // Render Level 1 Chromosome Arm Geometry & 1Mb Pyramid Density Bar
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

    const padX = width < 480 ? 12 : 24;
    const drawW = Math.max(40, width - padX * 2);
    const barH = 24;
    const barY = (height - barH) / 2;
    const chrLen = Math.max(1, currentChromOverview.length);
    const cenX = padX + (currentChromOverview.centromere / chrLen) * drawW;

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

    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(cenX - 2, barY + 4, 4, barH - 8);

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

    ctx.fillStyle = '#64748b';
    ctx.font = '500 9px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('p', padX + 7, barY + 15);
    ctx.textAlign = 'right';
    ctx.fillText('q', padX + drawW - 7, barY + 15);

    const vfX = padX + (windowStart / chrLen) * drawW;
    const vfW = Math.max(6, ((windowEnd - windowStart) / chrLen) * drawW);

    ctx.fillStyle = 'rgba(37, 99, 235, 0.16)';
    ctx.fillRect(vfX, barY - 4, vfW, barH + 8);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(vfX, barY - 4, vfW, barH + 8);

    variants.forEach((v) => {
      const lx = padX + (v.pos / chrLen) * drawW;
      ctx.beginPath();
      ctx.arc(lx, barY - 7, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = v.score >= 10 ? '#dc2626' : '#f59e0b';
      ctx.fill();
    });
  }, [currentChromOverview, containerPyramid, windowStart, windowEnd, variants, viewportEpoch]);

  // Render Level 2/3 High-Resolution Track Canvas (Edge-safe ruler + responsive tick count)
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

    const isCompact = width < 520;
    const padLeft = isCompact ? 16 : 40;
    const padRight = isCompact ? 16 : 40;
    const drawW = Math.max(40, width - padLeft - padRight);
    const span = Math.max(1, windowEnd - windowStart);

    // 1. Genomic Coordinate Ruler (adaptive tick count + edge-clamped textAlign)
    const rulerY = 32;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, rulerY);
    ctx.lineTo(width - padRight, rulerY);
    ctx.stroke();

    const tickCount = drawW < 340 ? 2 : drawW < 560 ? 4 : 6;
    for (let i = 0; i <= tickCount; i++) {
      const tickBp = Math.round(windowStart + (i / tickCount) * span);
      const tx = padLeft + (i / tickCount) * drawW;

      ctx.beginPath();
      ctx.moveTo(tx, rulerY - 6);
      ctx.lineTo(tx, rulerY);
      ctx.strokeStyle = '#94a3b8';
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = isCompact
        ? '500 10px ui-monospace, SFMono-Regular, monospace'
        : '500 11px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = i === 0 ? 'left' : i === tickCount ? 'right' : 'center';
      const label =
        span < 50_000
          ? `${tickBp.toLocaleString()} bp`
          : `${(tickBp / 1_000_000).toFixed(2)} Mb`;
      ctx.fillText(label, tx, rulerY - 10);
    }

    // 2. Real .plasmid Indexed Blocks & Reference Sequence Track
    const blockTrackY = 86;
    ctx.fillStyle = '#0f172a';
    ctx.font = isCompact
      ? '600 11px Inter, Pretendard, sans-serif'
      : '600 12px Inter, Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      isCompact
        ? nt.trackBlocksShort(matchedEntries.length)
        : nt.trackBlocksTitle(matchedEntries.length),
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
      ctx.font = '400 11px Inter, Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(nt.noBlocksOverlap, width / 2, blockTrackY + 4, drawW);
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
        ctx.roundRect(bx, blockTrackY - 9 + rowOffset, bw, 18, 4);
        ctx.fill();

        ctx.fillStyle = '#475569';
        ctx.font = '500 10px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'center';
        const tagText = `${entry.entry_type} #${entry.chunk_start} (${entry.payload_bytes}B)`;
        const safeCenter = Math.min(
          width - padRight - 65,
          Math.max(padLeft + 65, bx + bw / 2)
        );
        ctx.fillText(tagText, safeCenter, blockTrackY + 22, drawW);
      });
    }

    if (referenceSequence) {
      const maxChars = isCompact ? 24 : 60;
      const preview =
        referenceSequence.length > maxChars
          ? `${referenceSequence.slice(0, maxChars)}… (${referenceSequence.length} bp)`
          : `${referenceSequence} (${referenceSequence.length} bp)`;
      ctx.fillStyle = '#0f766e';
      ctx.font = '600 10px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`FASTA: ${preview}`, padLeft, blockTrackY + 36, drawW);
    }

    // 3. Decoded Variants Track
    const varY = 172;
    ctx.fillStyle = '#0f172a';
    ctx.font = isCompact
      ? '600 11px Inter, Pretendard, sans-serif'
      : '600 12px Inter, Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      isCompact
        ? nt.trackVariantsShort(variants.length)
        : nt.trackVariantsTitle(variants.length),
      padLeft,
      varY - 22
    );

    if (loadError) {
      ctx.fillStyle = '#dc2626';
      ctx.font = '500 11px Inter, Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${nt.errorPrefix} ${loadError}`, width / 2, varY + 14, drawW);
    } else if (span <= 20000) {
      if (variants.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '400 12px Inter, Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          lastQueryResult?.unmappedLiftoverReason
            ? nt.unmappedLiftoverMsg
            : nt.noVariantsMsg,
          width / 2,
          varY + 16,
          drawW
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

          const safeVx = Math.min(width - padRight - 28, Math.max(padLeft + 28, vx));
          ctx.fillStyle = '#0f172a';
          ctx.font = '600 11px ui-monospace, SFMono-Regular, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${v.ref}>${v.alt}`, safeVx, varY - 16);

          ctx.fillStyle = pinColor;
          ctx.font = '600 10px Inter, Pretendard, sans-serif';
          ctx.fillText(v.clinvar || v.id, safeVx, varY + 24);
        });
      }
    } else if (densityBins.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '400 12px Inter, Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(nt.noVariantsMsg, width / 2, varY + 16, drawW);
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
    nt,
    viewportEpoch,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const isCompact = rect.width < 520;
    const padLeft = isCompact ? 16 : 40;
    const padRight = isCompact ? 16 : 40;
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

      const badgeX = Math.min(rect.width - 56, Math.max(56, hoverPos.x));
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(badgeX - 52, 6, 104, 20, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '500 10px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${hoverPos.bp.toLocaleString()} bp`, badgeX, 20);

      if (hoveredVariant) {
        const label = `${hoveredVariant.gene ? `${hoveredVariant.gene} • ` : ''}${hoveredVariant.id} (${hoveredVariant.ref}>${hoveredVariant.alt})`;
        const boxW = Math.min(rect.width - 16, Math.max(130, label.length * 6.5));
        const pillX = Math.min(rect.width - boxW / 2 - 8, Math.max(boxW / 2 + 8, hoverPos.x));
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.roundRect(pillX - boxW / 2, 212, boxW, 22, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 10px Inter, Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, pillX, 227, boxW - 8);
      }
    }
  }, [hoverPos, hoveredVariant, viewportEpoch]);

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
    <div
      ref={containerRootRef}
      style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', minWidth: 0 }}
    >
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '20px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {nt.title}
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
                whiteSpace: 'nowrap',
              }}
            >
              {windowEnd - windowStart <= 20000 ? nt.level3Badge : nt.level2Badge}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>{nt.subtitle}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: assembly === asm ? 700 : 500,
                  backgroundColor: assembly === asm ? '#ffffff' : 'transparent',
                  color: assembly === asm ? '#2563eb' : '#64748b',
                  borderRadius: '6px',
                  border: 'none',
                  boxShadow: assembly === asm ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {asm} ({asm === 'GRCh38' ? 'hg38' : 'hg19'})
              </button>
            ))}
          </div>

          {isVaultSource ? (
            <span
              data-testid="navigator-vault-airgap-badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid #86efac',
                backgroundColor: '#f0fdf4',
                color: '#166534',
                maxWidth: '100%',
                wordBreak: 'break-word',
              }}
            >
              <ShieldCheck size={15} color="#16a34a" style={{ flexShrink: 0 }} />
              <span>{nt.vaultAirgapLocked}</span>
            </span>
          ) : (
            <>
              <button
                onClick={() => {
                  const next = !isPublicAirgapped;
                  opfs.setAirgapped(next);
                  setIsPublicAirgapped(next);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isPublicAirgapped ? '1px solid #86efac' : '1px solid #e2e8f0',
                  backgroundColor: isPublicAirgapped ? '#f0fdf4' : '#ffffff',
                  color: isPublicAirgapped ? '#166534' : '#475569',
                  whiteSpace: 'nowrap',
                }}
              >
                {isPublicAirgapped ? (
                  <ShieldCheck size={15} color="#16a34a" />
                ) : (
                  <Shield size={15} color="#64748b" />
                )}
                {isPublicAirgapped ? nt.airgapActive : nt.edgeStreaming}
              </button>

              {!isOpfsCached && (
                <button
                  onClick={() => void handleCacheToOpfs()}
                  disabled={cachingProgress !== null}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: cachingProgress !== null ? 'wait' : 'pointer',
                    border: '1px solid #2563eb',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Download size={14} />
                  {cachingProgress !== null
                    ? `${nt.cachingPrefix} (${cachingProgress}%)`
                    : nt.cacheToOpfs}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Honest Error Banner */}
      {loadError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '14px 18px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            color: '#991b1b',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
            <span style={{ wordBreak: 'break-word' }}>
              <strong>{nt.errorPrefix}</strong> {loadError}
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
              whiteSpace: 'nowrap',
            }}
          >
            {nt.retryBtn}
          </button>
        </div>
      )}

      {/* 2. Dynamically Discovered Indexed Loci */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          padding: '4px 0',
          maxWidth: '100%',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#64748b',
            marginRight: '4px',
            whiteSpace: 'nowrap',
          }}
        >
          {nt.indexedLociLabel}
        </span>
        {indexedChips.length === 0 ? (
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
            {isLoading ? nt.readingDirectory : nt.noLeavesLoaded}
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
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: isChipActive ? 700 : 500,
                  border: isChipActive ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  backgroundColor: isChipActive ? '#eff6ff' : '#ffffff',
                  color: isChipActive ? '#2563eb' : '#334155',
                  cursor: 'pointer',
                  maxWidth: '100%',
                  flexWrap: 'wrap',
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
          padding: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '10px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
            {nt.karyotypeTitle} ({assembly})
          </span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {containerPyramid
              ? nt.pyramidSummary(
                  containerPyramid.total_variants,
                  containerPyramid.total_pathogenic
                )
              : nt.loadingPyramid}
          </span>
        </div>
        <div style={{ height: '70px', width: '100%' }}>
          <canvas
            ref={karyotypeCanvasRef}
            onClick={(e) => {
              const canvas = karyotypeCanvasRef.current;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              const padOuter = rect.width < 420 ? 4 : 8;
              const x = e.clientX - rect.left;
              const colWidth = (rect.width - padOuter * 2) / ORDERED_CHROMOSOMES.length;
              const idx = Math.floor((x - padOuter) / colWidth);
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
          padding: '16px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              {selectedChrom} {nt.densityBarSuffix}
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
              wordBreak: 'break-word',
            }}
          >
            {nt.windowLabel}: {windowStart.toLocaleString()} - {windowEnd.toLocaleString()} bp (
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
              const padX = rect.width < 480 ? 12 : 24;
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
          padding: '16px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              {nt.viewportTitle}
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
                <RefreshCw size={12} /> {nt.slicingLoading}
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
                  wordBreak: 'break-all',
                }}
              >
                {lastQueryResult.slicingPlan.byte_ranges.length > 0
                  ? `Range: bytes=${lastQueryResult.slicingPlan.byte_ranges
                      .map((r) => `${r.start}-${r.end}`)
                      .join(',')}`
                  : nt.noChunksNeeded}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setWindowStart(1);
                setWindowEnd(200);
              }}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                fontSize: '11px',
                fontWeight: 600,
                color: '#0f766e',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {nt.fastaJumpBtn}
            </button>
            <button
              onClick={() => handlePan('left')}
              title={nt.panLeft}
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
              title={nt.panRight}
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
            <div style={{ width: '1px', height: '16px', backgroundColor: '#e2e8f0', margin: '0 2px' }} />
            <button
              onClick={() => handleZoom(0.5)}
              title={nt.zoomIn}
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
              title={nt.zoomOut}
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

      {/* 6. Decoded Slice & Variant Inspector */}
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
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    {inspectedVariant.gene || nt.unannotatedGene} • {inspectedVariant.id}
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
                        whiteSpace: 'nowrap',
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

              <div>
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
                  {nt.displayedAssembly}: <strong style={{ color: '#2563eb' }}>{assembly}</strong>
                  {lastQueryResult?.session.header.reference_build
                    ? ` (${nt.containerLabel}: ${lastQueryResult.session.header.reference_build})`
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
                  {nt.vcfInfoCard}
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
                    : nt.noInfoTags}
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                  {nt.chunkTransferCard}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#0f172a',
                    fontFamily: 'ui-monospace, monospace',
                    marginTop: '4px',
                  }}
                >
                  {nt.chunksLabel}: #{lastQueryResult?.slicingPlan?.chunk_indices.join(', #') || '—'}
                  <br />
                  {nt.sliceSizeLabel}:{' '}
                  {(lastQueryResult?.slicingPlan?.total_download_bytes ?? 0).toLocaleString()} B /{' '}
                  {(lastQueryResult?.session.totalFileSize ?? 0).toLocaleString()} B
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                  {nt.chunkShaCard}
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
                    : nt.noChunkDigest}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#64748b',
              fontSize: '13px',
            }}
          >
            <Database size={16} color="#94a3b8" style={{ flexShrink: 0 }} />
            <span style={{ wordBreak: 'break-word' }}>
              {loadError
                ? nt.errorInspectorMsg
                : nt.emptyInspectorMsg(
                    selectedChrom,
                    windowStart.toLocaleString(),
                    windowEnd.toLocaleString(),
                    assembly,
                    referenceSequence?.length
                  )}
            </span>
          </div>
        )}
      </div>

      {/* 7. Engine Telemetry Log Drawer */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '6px',
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
            <Activity size={14} color="#2563eb" /> {nt.auditLogTitle}
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            {nt.latestEvents(logs.length)}
          </span>
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
            <div
              key={log.id}
              style={{
                display: 'flex',
                gap: '8px',
                color: '#475569',
                flexWrap: 'wrap',
                wordBreak: 'break-word',
              }}
            >
              <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>[{log.timestamp}]</span>
              <span
                style={{
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  color:
                    log.type === 'opfs'
                      ? '#16a34a'
                      : log.type === 'network'
                        ? '#2563eb'
                        : '#d97706',
                }}
              >
                [{localizeAuditTypeBadge(log.type, lang)}]
              </span>
              <span style={{ wordBreak: 'break-word' }}>
                {localizeAuditMessage(log.message, lang)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
