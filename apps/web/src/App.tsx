import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Cpu,
  ExternalLink,
  FileText,
  Globe,
  HardDrive,
  Layers,
  Lock,
  Radio,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  detectInitialLanguage,
  formatVaultErrorMessage,
  isSupportedLanguage,
  localizeClinicalSignificance,
  persistLanguageChoice,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  syncDocumentLanguage,
  TRANSLATIONS,
} from './i18n'
import { ClinicalSummaryBento } from './components/ClinicalSummaryBento'
import { ClinVarIntersectionPanel } from './components/ClinVarIntersectionPanel'
import { GenomeNavigator } from './components/GenomeNavigator'
import { SwarmPanel } from './components/SwarmPanel'
import {
  DEFAULT_OPFS_FILENAME,
  plasmidContainerClient,
  type ContainerSession,
} from './services/plasmidContainerClient'
import { webRtcSwarmClient, type SwarmSnapshot } from './services/webrtcSwarm'
import { decoderClient } from './services/decoderClient'
import {
  detectVaultFileKind,
  opfs,
  sanitizeVaultFilename,
  VAULT_DIR_NAME,
  type OPFSQuota,
  type VaultFileEntry,
} from './services/opfs'
import type {
  CatalogVariantItem,
  ClinVarIntersectionReport,
  ClinVarMatchedVariant,
  DataSourceMode,
  LiftoverResult,
  WasmMerkleVerification,
} from './types/plasmid'

type WorkspaceTabId =
  | 'navigator'
  | 'intersection'
  | 'stream'
  | 'liftover'
  | 'wiki'
  | 'swarm'
  | 'governance'

interface ParsedCoordinateQuery {
  chrom: string
  pos: number
  endPos?: number
  display: string
}

function parseCoordinateQuery(raw: string): ParsedCoordinateQuery | null {
  const cleaned = raw.trim().replace(/,/g, '')
  const match = /^(?:chr)?([0-9]{1,2}|X|Y|M|MT):(\d+)(?:-(\d+))?$/i.exec(cleaned)
  if (!match) return null

  const rawChr = match[1].toUpperCase()
  let normChr: string | null = null
  if (rawChr === 'MT' || rawChr === 'M') {
    normChr = 'chrM'
  } else if (rawChr === 'X' || rawChr === 'Y') {
    normChr = `chr${rawChr}`
  } else {
    const n = Number(rawChr)
    if (Number.isInteger(n) && n >= 1 && n <= 22) {
      normChr = `chr${n}`
    }
  }
  if (!normChr) return null

  const start = Number(match[2])
  if (!Number.isFinite(start) || start < 1 || start > 300_000_000) return null

  if (match[3]) {
    const end = Number(match[3])
    if (!Number.isFinite(end) || end < start || end > 300_000_000) return null
    return {
      chrom: normChr,
      pos: start,
      endPos: end,
      display: `${normChr}:${start.toLocaleString()}-${end.toLocaleString()}`,
    }
  }

  return {
    chrom: normChr,
    pos: start,
    display: `${normChr}:${start.toLocaleString()}`,
  }
}

export default function App() {
  const initialVaultPath = opfs.getActiveVaultPath()
  const [lang, setLang] = useState<SupportedLanguage>(() => detectInitialLanguage())
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('navigator')
  const [railCollapsed, setRailCollapsed] = useState<boolean>(false)
  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1200 : false
  )
  const [mobileVaultExpanded, setMobileVaultExpanded] = useState<boolean>(false)

  const handleLanguageChange = useCallback((rawValue: string) => {
    if (!isSupportedLanguage(rawValue)) return
    setLang(rawValue)
    persistLanguageChoice(rawValue)
  }, [])

  const [globalSearch, setGlobalSearch] = useState<string>('')
  const [searchFocused, setSearchFocused] = useState<boolean>(false)
  const globalSearchInputRef = useRef<HTMLInputElement | null>(null)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)

  const [sourceMode, setSourceMode] = useState<DataSourceMode>(
    initialVaultPath ? 'vault' : 'public'
  )
  const [activeOpfsFilename, setActiveOpfsFilename] = useState<string>(
    initialVaultPath || DEFAULT_OPFS_FILENAME
  )
  const [vaultFiles, setVaultFiles] = useState<VaultFileEntry[]>([])
  const [opfsQuota, setOpfsQuota] = useState<OPFSQuota | null>(null)
  const [isDraggingVault, setIsDraggingVault] = useState<boolean>(false)
  const [vaultImporting, setVaultImporting] = useState<boolean>(false)
  const [vaultError, setVaultError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const sourceReqSeqRef = useRef<number>(0)

  const [session, setSession] = useState<ContainerSession | null>(null)
  const [catalogItems, setCatalogItems] = useState<CatalogVariantItem[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [catalogLoading, setCatalogLoading] = useState<boolean>(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  const [verifying, setVerifying] = useState<boolean>(false)
  const [merkleResult, setMerkleResult] = useState<WasmMerkleVerification | null>(null)
  const [merkleElapsedMs, setMerkleElapsedMs] = useState<number | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const [simulateAdversarialDrift, setSimulateAdversarialDrift] = useState<boolean>(false)
  const [liftoverResult, setLiftoverResult] = useState<LiftoverResult | null>(null)
  const [liftoverError, setLiftoverError] = useState<string | null>(null)
  const [guardError, setGuardError] = useState<string | null>(null)

  const [intersectionReport, setIntersectionReport] =
    useState<ClinVarIntersectionReport | null>(null)
  const [intersectionLoading, setIntersectionLoading] = useState<boolean>(false)
  const [intersectionError, setIntersectionError] = useState<string | null>(null)
  const [navigatorJumpTarget, setNavigatorJumpTarget] = useState<{
    chrom: string
    pos: number
    endPos?: number
    seq: number
  } | null>(null)

  const [swarmSnapshot, setSwarmSnapshot] = useState<SwarmSnapshot>(() =>
    webRtcSwarmClient.getSnapshot()
  )

  useEffect(() => {
    const unsubscribe = webRtcSwarmClient.subscribe(setSwarmSnapshot)
    const onBeforeUnload = () => {
      void webRtcSwarmClient.leaveRoom()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      unsubscribe()
    }
  }, [])

  const t = TRANSLATIONS[lang]
  const wt = t.workspace

  // Track responsive breakpoint (<1200px vs >=1200px) cleanly
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 1199px)')
    const sync = () => setIsCompactViewport(window.innerWidth < 1200 || mq.matches)
    sync()
    mq.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    return () => {
      mq.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])

  // Plausible-style '/' keyboard shortcut to focus global locus/gene search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return
        }
      }
      e.preventDefault()
      globalSearchInputRef.current?.focus()
      globalSearchInputRef.current?.select()
      setSearchFocused(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Dismiss search popover when clicking outside
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const refreshVaultMetadata = useCallback(async () => {
    const [files, quota] = await Promise.all([opfs.listVaultFiles(), opfs.getQuota()])
    setVaultFiles(files)
    setOpfsQuota(quota)
    return files
  }, [])

  const activateDataSource = useCallback(
    async (nextMode: DataSourceMode, nextOpfsPath: string) => {
      const reqSeq = ++sourceReqSeqRef.current
      setCatalogLoading(true)
      setCatalogError(null)
      setMerkleResult(null)
      setMerkleElapsedMs(null)
      setVerifyError(null)

      try {
        const airgapped =
          nextMode === 'vault' ? true : await opfs.hasFile(DEFAULT_OPFS_FILENAME)
        const targetFile = nextMode === 'vault' ? nextOpfsPath : DEFAULT_OPFS_FILENAME

        const { session: loadedSession, items } =
          await plasmidContainerClient.loadCatalogVariants({
            sourceMode: nextMode,
            airgapped,
            opfsFilename: targetFile,
          })

        if (reqSeq !== sourceReqSeqRef.current) return
        setNavigatorJumpTarget(null)
        setSourceMode(nextMode)
        setActiveOpfsFilename(targetFile)
        opfs.setActiveVaultPath(nextMode === 'vault' ? targetFile : null)
        setSession(loadedSession)
        setCatalogItems(items)
        setSelectedKey(items[0]?.key ?? null)
      } catch (err: unknown) {
        if (reqSeq !== sourceReqSeqRef.current) return
        setCatalogError(err instanceof Error ? err.message : String(err))
      } finally {
        if (reqSeq === sourceReqSeqRef.current) {
          setCatalogLoading(false)
        }
      }
    },
    []
  )

  // Synchronize <html lang="..."> and document.title with active UI language
  useEffect(() => {
    syncDocumentLanguage(lang)
  }, [lang])

  // Load saved OPFS vault inventory and active dataset on mount
  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      const reqSeq = ++sourceReqSeqRef.current
      setCatalogLoading(true)
      setCatalogError(null)
      try {
        const files = await refreshVaultMetadata()
        const savedPath = opfs.getActiveVaultPath()
        const validSavedVault =
          savedPath && files.some((f) => f.opfsPath === savedPath) ? savedPath : null

        if (savedPath && !validSavedVault) {
          opfs.setActiveVaultPath(null)
        }

        const mode: DataSourceMode = validSavedVault ? 'vault' : 'public'
        const targetFile = validSavedVault ?? DEFAULT_OPFS_FILENAME
        const airgapped =
          mode === 'vault' ? true : await opfs.hasFile(DEFAULT_OPFS_FILENAME)

        const { session: loadedSession, items } =
          await plasmidContainerClient.loadCatalogVariants({
            sourceMode: mode,
            airgapped,
            opfsFilename: targetFile,
          })

        if (cancelled || reqSeq !== sourceReqSeqRef.current) return
        setSourceMode(mode)
        setActiveOpfsFilename(targetFile)
        setSession(loadedSession)
        setCatalogItems(items)
        if (items.length > 0) {
          setSelectedKey((prev) =>
            prev && items.some((it) => it.key === prev) ? prev : items[0].key
          )
        } else {
          setSelectedKey(null)
        }
      } catch (err: unknown) {
        if (cancelled || reqSeq !== sourceReqSeqRef.current) return
        setCatalogError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled && reqSeq === sourceReqSeqRef.current) setCatalogLoading(false)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [refreshVaultMetadata])

  const handleImportVaultFile = async (file: File) => {
    const reqSeq = ++sourceReqSeqRef.current
    setVaultImporting(true)
    setVaultError(null)

    try {
      const arrayBuf = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuf)
      if (bytes.byteLength === 0) {
        throw new Error('Selected genomic file is empty (0 bytes)')
      }

      const sanitizedName = sanitizeVaultFilename(file.name)
      const kind = detectVaultFileKind(sanitizedName, bytes)

      // Validate in local WASM BEFORE writing to OPFS so invalid uploads never overwrite existing vault files
      if (kind === 'vcf') {
        await decoderClient.parseVcfDataset(bytes, 'GRCh38')
      } else {
        const parsedPlasmid = await decoderClient.parseLocalPlasmid(bytes)
        if (!parsedPlasmid.merkle.verified) {
          throw new Error(
            `Merkle root integrity check failed for "${sanitizedName}": expected ${parsedPlasmid.merkle.expected_root_hex}, calculated ${parsedPlasmid.merkle.calculated_root_hex}`
          )
        }
      }

      const candidatePath = `${VAULT_DIR_NAME}/${sanitizedName}`
      plasmidContainerClient.evictFile(candidatePath)
      const savedEntry = await opfs.saveVaultFile(file.name, bytes)

      const { session: loadedSession, items } =
        await plasmidContainerClient.loadCatalogVariants({
          sourceMode: 'vault',
          airgapped: true,
          opfsFilename: savedEntry.opfsPath,
        })

      await refreshVaultMetadata()
      if (reqSeq !== sourceReqSeqRef.current) return

      opfs.setActiveVaultPath(savedEntry.opfsPath)
      setNavigatorJumpTarget(null)
      setSourceMode('vault')
      setActiveOpfsFilename(savedEntry.opfsPath)
      setSession(loadedSession)
      setCatalogItems(items)
      setSelectedKey(items[0]?.key ?? null)
      setCatalogError(null)
      setMerkleResult(null)
      setMerkleElapsedMs(null)
      setVerifyError(null)
    } catch (err: unknown) {
      await refreshVaultMetadata()
      if (reqSeq === sourceReqSeqRef.current) {
        setVaultError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setVaultImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteVaultFile = async (entry: VaultFileEntry) => {
    setVaultError(null)
    try {
      await opfs.deleteVaultFile(entry.name)
      plasmidContainerClient.evictFile(entry.opfsPath)
      const remaining = await refreshVaultMetadata()

      if (sourceMode === 'vault' && activeOpfsFilename === entry.opfsPath) {
        if (remaining.length > 0) {
          await activateDataSource('vault', remaining[0].opfsPath)
        } else {
          await activateDataSource('public', DEFAULT_OPFS_FILENAME)
        }
      }
    } catch (err: unknown) {
      setVaultError(err instanceof Error ? err.message : String(err))
    }
  }

  const current: CatalogVariantItem | null = useMemo(() => {
    if (catalogItems.length === 0) return null
    if (selectedKey) {
      const match = catalogItems.find((item) => item.key === selectedKey)
      if (match) return match
    }
    return catalogItems[0]
  }, [catalogItems, selectedKey])

  // Run real WASM LiftoverEngine + CoordinateGuard whenever selected variant or drift toggle changes
  useEffect(() => {
    if (!current) {
      setLiftoverResult(null)
      setLiftoverError(null)
      setGuardError(null)
      return
    }

    let cancelled = false
    const containerAsm = session?.containerAssembly ?? 'GRCh38'
    const liftDirection = containerAsm === 'GRCh37' ? 'hg19_to_hg38' : 'hg38_to_hg19'

    const runWasmLiftover = async () => {
      try {
        const res = await decoderClient.liftoverCoordinate(
          liftDirection,
          current.variant.chrom,
          current.variant.pos,
          current.variant.ref
        )
        if (cancelled) return
        setLiftoverResult(res)
        setLiftoverError(null)
      } catch (err: unknown) {
        if (cancelled) return
        setLiftoverResult(null)
        setLiftoverError(err instanceof Error ? err.message : String(err))
      }

      const refAllele = current.variant.ref
      const testPos = simulateAdversarialDrift
        ? current.variant.pos + 1
        : current.variant.pos

      try {
        await decoderClient.verifyLocusConsistency({
          rsid: current.variant.id,
          chrom: current.variant.chrom,
          queriedPos: testPos,
          assertedRef: refAllele,
          authoritativePos: current.variant.pos,
          authoritativeRef: refAllele,
          targetBuild: containerAsm,
        })
        if (!cancelled) setGuardError(null)
      } catch (err: unknown) {
        if (!cancelled) {
          setGuardError(err instanceof Error ? err.message : String(err))
        }
      }
    }

    void runWasmLiftover()
    return () => {
      cancelled = true
    }
  }, [current, session?.containerAssembly, simulateAdversarialDrift])

  // Automatically intersect active OPFS Vault genome against public ClinVar Zstd pack in WASM
  useEffect(() => {
    if (sourceMode !== 'vault' || !activeOpfsFilename) {
      setIntersectionReport(null)
      setIntersectionLoading(false)
      setIntersectionError(null)
      return
    }

    const abortController = new AbortController()
    setIntersectionLoading(true)
    setIntersectionError(null)

    plasmidContainerClient
      .intersectVaultWithPublicClinvar({
        vaultOpfsFilename: activeOpfsFilename,
        signal: abortController.signal,
      })
      .then((report) => {
        if (!abortController.signal.aborted) {
          setIntersectionReport(report)
          setIntersectionLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!abortController.signal.aborted) {
          setIntersectionError(err instanceof Error ? err.message : String(err))
          setIntersectionLoading(false)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [sourceMode, activeOpfsFilename])

  const handleVerifyMerkle = async () => {
    setVerifying(true)
    setVerifyError(null)
    try {
      const airgapped =
        sourceMode === 'vault' ? true : await opfs.hasFile(DEFAULT_OPFS_FILENAME)
      const { verification, elapsedMs, session: verifiedSession } =
        await plasmidContainerClient.verifyContainerMerkle({
          sourceMode,
          airgapped,
          opfsFilename: activeOpfsFilename,
        })
      setSession(verifiedSession)
      setMerkleResult(verification)
      setMerkleElapsedMs(elapsedMs)
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : String(err))
      setMerkleResult(null)
    } finally {
      setVerifying(false)
    }
  }

  const savingsPct = useMemo(() => {
    if (!session || !current || session.totalFileSize <= 0) return null
    const saved =
      ((session.totalFileSize - current.bytesTransferred) / session.totalFileSize) * 100
    return Math.max(0, saved).toFixed(1)
  }, [session, current])

  // Real-Data Search Filtering (Coordinate + ClinVar Matches + Decoded Catalog Loci)
  const parsedCoordSearch = useMemo(
    () => parseCoordinateQuery(globalSearch),
    [globalSearch]
  )

  const searchClinvarHits = useMemo<ClinVarMatchedVariant[]>(() => {
    const q = globalSearch.trim().toLowerCase()
    if (!q || !intersectionReport) return []
    return intersectionReport.matches
      .filter((m) => {
        const hay = [
          m.gene ?? '',
          m.rsid,
          m.chrom,
          String(m.pos),
          `${m.chrom}:${m.pos}`,
          m.clinical_significance,
          localizeClinicalSignificance(m.clinical_significance, lang),
          ...m.conditions,
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 5)
  }, [globalSearch, intersectionReport, lang])

  const searchCatalogHits = useMemo<CatalogVariantItem[]>(() => {
    const q = globalSearch.trim().toLowerCase()
    if (!q) return []
    return catalogItems
      .filter((item) => {
        const v = item.variant
        const hay = [
          v.gene ?? '',
          v.id,
          v.chrom,
          String(v.pos),
          `${v.chrom}:${v.pos}`,
          v.clinvar ?? '',
          localizeClinicalSignificance(v.clinvar, lang),
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 6)
  }, [globalSearch, catalogItems, lang])

  const handleSelectCoordSearch = (coord: ParsedCoordinateQuery) => {
    setActiveTab('navigator')
    setNavigatorJumpTarget((prev) => ({
      chrom: coord.chrom,
      pos: coord.pos,
      endPos: coord.endPos,
      seq: (prev?.seq ?? 0) + 1,
    }))
    setSearchFocused(false)
  }

  const handleSelectClinvarHit = (match: ClinVarMatchedVariant) => {
    const matchedItem = catalogItems.find(
      (item) =>
        item.variant.chrom === match.chrom &&
        (item.variant.pos === match.personal_pos ||
          item.variant.pos === match.pos ||
          (Boolean(match.rsid) && item.variant.id === match.rsid))
    )
    if (matchedItem) {
      setSelectedKey(matchedItem.key)
    }
    setActiveTab('navigator')
    setNavigatorJumpTarget((prev) => ({
      chrom: match.chrom,
      pos: match.pos,
      seq: (prev?.seq ?? 0) + 1,
    }))
    setSearchFocused(false)
  }

  const handleSelectCatalogHit = (item: CatalogVariantItem) => {
    setNavigatorJumpTarget(null)
    setSelectedKey(item.key)
    if (
      activeTab !== 'navigator' &&
      activeTab !== 'stream' &&
      activeTab !== 'liftover' &&
      activeTab !== 'wiki'
    ) {
      setActiveTab('navigator')
    }
    setSearchFocused(false)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchFocused(false)
      globalSearchInputRef.current?.blur()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (parsedCoordSearch) {
        handleSelectCoordSearch(parsedCoordSearch)
      } else if (searchClinvarHits.length > 0) {
        handleSelectClinvarHit(searchClinvarHits[0])
      } else if (searchCatalogHits.length > 0) {
        handleSelectCatalogHit(searchCatalogHits[0])
      }
    }
  }

  const tabs = useMemo(
    () =>
      [
        { id: 'navigator', icon: Compass, label: t.header.tabs.navigator },
        { id: 'intersection', icon: Stethoscope, label: t.header.tabs.intersection },
        { id: 'stream', icon: Layers, label: t.header.tabs.viewer },
        { id: 'liftover', icon: ArrowRightLeft, label: t.header.tabs.liftover },
        { id: 'wiki', icon: FileText, label: t.header.tabs.wiki },
        { id: 'swarm', icon: Radio, label: t.header.tabs.network },
        { id: 'governance', icon: Scale, label: t.header.tabs.sources },
      ] as const,
    [t.header.tabs]
  )

  const activeVaultDisplayName = useMemo(() => {
    if (sourceMode !== 'vault') return t.vault.publicDemoSource
    const found = vaultFiles.find((vf) => vf.opfsPath === activeOpfsFilename)
    return found ? found.name : activeOpfsFilename.replace(`${VAULT_DIR_NAME}/`, '')
  }, [sourceMode, vaultFiles, activeOpfsFilename, t.vault.publicDemoSource])

  const showVaultBody =
    !isCompactViewport || mobileVaultExpanded || Boolean(vaultError) || vaultImporting

  return (
    <div className={`plasmid-workspace ${railCollapsed ? 'rail-collapsed' : ''}`}>
      {/* ===================================================================
          1. LEFT NAVIGATION RAIL (Desktop >=1200px) & COMPACT MOBILE GNB (<1200px)
         =================================================================== */}
      <aside className="plasmid-left-rail">
        {!isCompactViewport ? (
          /* Desktop Collapsible Rail */
          <div
            className="plasmid-desktop-only"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Brand + Collapse Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: railCollapsed ? 'center' : 'space-between',
                  gap: '8px',
                }}
              >
                {!railCollapsed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        backgroundColor: '#0f172a',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Cpu size={17} color="#ffffff" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '16px',
                            fontWeight: 800,
                            letterSpacing: '-0.02em',
                            color: '#0f172a',
                          }}
                        >
                          {t.header.title}
                        </span>
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: '10px',
                            padding: '1px 5px',
                            backgroundColor: '#e2e8f0',
                            color: '#334155',
                            borderRadius: '4px',
                            fontWeight: 700,
                          }}
                        >
                          v0.1.0
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  data-testid="rail-collapse-btn"
                  aria-label={railCollapsed ? wt.expandRail : wt.collapseRail}
                  title={railCollapsed ? wt.expandRail : wt.collapseRail}
                  onClick={() => setRailCollapsed((prev) => !prev)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {railCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                </button>
              </div>

              {!railCollapsed && (
                <p
                  style={{
                    margin: '-8px 0 0 0',
                    fontSize: '11px',
                    color: '#64748b',
                    lineHeight: 1.45,
                  }}
                >
                  {t.header.subtitle}
                </p>
              )}

              {/* Vertical 7-Tab Navigation */}
              <nav
                aria-label={wt.navSectionLabel}
                style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                {!railCollapsed && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '0 8px 4px 8px',
                    }}
                  >
                    {wt.navSectionLabel}
                  </span>
                )}

                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const active = activeTab === tab.id
                  const matchBadge =
                    tab.id === 'intersection' &&
                    sourceMode === 'vault' &&
                    intersectionReport
                      ? intersectionReport.matched_count
                      : tab.id === 'swarm' && swarmSnapshot.joined
                        ? swarmSnapshot.peers.filter((p) => p.status === 'connected').length
                        : null

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      data-testid={`nav-tab-${tab.id}`}
                      onClick={() => setActiveTab(tab.id)}
                      title={railCollapsed ? tab.label : undefined}
                      aria-label={tab.label}
                      aria-current={active ? 'page' : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: railCollapsed ? 'center' : 'space-between',
                        gap: '8px',
                        width: '100%',
                        padding: railCollapsed ? '9px 0' : '8px 10px',
                        fontSize: '13px',
                        fontWeight: active ? 700 : 500,
                        backgroundColor: active ? '#ffffff' : 'transparent',
                        color: active ? '#0f172a' : '#475569',
                        border: active ? '1px solid #e2e8f0' : '1px solid transparent',
                        borderRadius: '8px',
                        boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.05)' : 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '9px',
                          minWidth: 0,
                        }}
                      >
                        <Icon
                          size={16}
                          color={active ? '#2563eb' : '#64748b'}
                          style={{ flexShrink: 0 }}
                        />
                        {!railCollapsed && (
                          <span
                            style={{
                              lineHeight: 1.3,
                              wordBreak: 'break-word',
                            }}
                          >
                            {tab.label}
                          </span>
                        )}
                      </span>

                      {!railCollapsed && matchBadge !== null && (
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '9999px',
                            backgroundColor: '#f0fdf4',
                            color: '#166534',
                            border: '1px solid #bbf7d0',
                            flexShrink: 0,
                          }}
                        >
                          {matchBadge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Bottom Language Selector & Repo Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  minWidth: 0,
                }}
              >
                {!railCollapsed && (
                  <Globe
                    size={14}
                    color="#475569"
                    style={{
                      position: 'absolute',
                      left: '10px',
                      pointerEvents: 'none',
                      flexShrink: 0,
                    }}
                  />
                )}
                <select
                  data-testid="language-select"
                  aria-label={wt.languageSelectAria}
                  title={wt.languageSelectAria}
                  value={lang}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    padding: railCollapsed ? '6px 4px' : '7px 28px 7px 30px',
                    fontSize: railCollapsed ? '11px' : '12px',
                    fontWeight: 600,
                    textAlign: railCollapsed ? 'center' : 'left',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {SUPPORTED_LANGUAGES.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {railCollapsed ? opt.code.toUpperCase() : opt.label}
                    </option>
                  ))}
                </select>
                {!railCollapsed && (
                  <ChevronDown
                    size={14}
                    color="#64748b"
                    style={{
                      position: 'absolute',
                      right: '9px',
                      pointerEvents: 'none',
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>

              {!railCollapsed && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px',
                    color: '#64748b',
                    padding: '0 4px',
                  }}
                >
                  <a
                    href="https://github.com/epgeno/plasmid"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#64748b', fontWeight: 500 }}
                  >
                    GitHub
                  </a>
                  <span>MIT / Apache-2.0</span>
                  <a
                    href="https://plasmid.wiki"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#64748b', fontWeight: 500 }}
                  >
                    plasmid.wiki
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Mobile / Tablet Compact Header + Scrollable 7-Tab Strip (<1200px) */
          <div className="plasmid-mobile-only">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                paddingBottom: '6px',
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    backgroundColor: '#0f172a',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Cpu size={15} color="#ffffff" />
                </div>
                <span
                  style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {t.header.title}
                </span>
                <span
                  className="tabular-nums"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '9999px',
                    backgroundColor: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <ShieldCheck size={11} />
                  <span>0 B</span>
                </span>
              </div>

              <div
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  minWidth: 0,
                  maxWidth: '176px',
                  flex: '0 1 auto',
                }}
              >
                <Globe
                  size={13}
                  color="#475569"
                  style={{
                    position: 'absolute',
                    left: '8px',
                    pointerEvents: 'none',
                    flexShrink: 0,
                  }}
                />
                <select
                  data-testid="language-select"
                  aria-label={wt.languageSelectAria}
                  value={lang}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    padding: '5px 24px 5px 25px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: '#f8fafc',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {SUPPORTED_LANGUAGES.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  color="#64748b"
                  style={{
                    position: 'absolute',
                    right: '7px',
                    pointerEvents: 'none',
                    flexShrink: 0,
                  }}
                />
              </div>
            </div>

            <nav
              aria-label={wt.navSectionLabel}
              className="plasmid-scroll-strip"
              style={{ gap: '4px', paddingBottom: '8px' }}
            >
              {tabs.map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-testid={`mobile-nav-tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={active ? 'page' : undefined}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: active ? 700 : 600,
                      backgroundColor: active ? '#0f172a' : '#f8fafc',
                      color: active ? '#ffffff' : '#475569',
                      border: active ? '1px solid #0f172a' : '1px solid #e2e8f0',
                      borderRadius: '9999px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Icon size={13} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        )}
      </aside>

      {/* ===================================================================
          2. CENTER ANALYSIS CANVAS
         =================================================================== */}
      <main className="plasmid-center-canvas">
        {/* Sticky Command Bar: '/' Global Gene/rsID/Coordinate Search + Active Variant Selector */}
        <div className="plasmid-command-bar">
          {/* Plausible '/' Global Locus Search */}
          <div ref={searchContainerRef} style={{ position: 'relative', minWidth: 0 }}>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                minWidth: 0,
              }}
            >
              <Search
                size={15}
                color="#64748b"
                style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }}
              />
              <input
                ref={globalSearchInputRef}
                data-testid="global-locus-search"
                type="text"
                value={globalSearch}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setGlobalSearch(e.target.value)
                  setSearchFocused(true)
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={wt.globalSearchPlaceholder}
                aria-label={wt.globalSearchPlaceholder}
                style={{
                  width: '100%',
                  minWidth: 0,
                  padding: '7px 34px 7px 32px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  fontSize: '13px',
                  color: '#0f172a',
                  fontWeight: 500,
                }}
              />
              {globalSearch.length > 0 ? (
                <button
                  type="button"
                  aria-label={wt.searchClearAria}
                  onClick={() => {
                    setGlobalSearch('')
                    globalSearchInputRef.current?.focus()
                  }}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#64748b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={13} />
                </button>
              ) : (
                <kbd
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    padding: '1px 6px',
                    fontSize: '11px',
                    fontFamily: 'ui-monospace, monospace',
                    fontWeight: 600,
                    color: '#64748b',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    pointerEvents: 'none',
                  }}
                >
                  /
                </kbd>
              )}
            </div>

            {/* Live Real-Data Search Popover */}
            {searchFocused && globalSearch.trim().length > 0 && (
              <div
                data-testid="global-search-results"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  zIndex: 40,
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.1)',
                  padding: '8px',
                  maxHeight: '320px',
                  overflowY: 'auto',
                }}
              >
                {parsedCoordSearch && (
                  <button
                    type="button"
                    data-testid="search-jump-coord-btn"
                    onClick={() => handleSelectCoordSearch(parsedCoordSearch)}
                    className="tabular-nums"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #bfdbfe',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginBottom:
                        searchClinvarHits.length > 0 || searchCatalogHits.length > 0
                          ? '8px'
                          : 0,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Compass size={13} />
                      <span>{wt.searchJumpCoord(parsedCoordSearch.display)}</span>
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace' }}>
                      ↵
                    </span>
                  </button>
                )}

                {searchClinvarHits.length > 0 && (
                  <div style={{ marginBottom: searchCatalogHits.length > 0 ? '8px' : 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        padding: '2px 6px 4px 6px',
                      }}
                    >
                      {wt.searchSectionPersonal}
                    </span>
                    {searchClinvarHits.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => handleSelectClinvarHit(m)}
                        className="tabular-nums"
                        style={{
                          width: '100%',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '7px 8px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: '#0f172a',
                          fontSize: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>
                          {m.gene || m.chrom} · {m.rsid}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#64748b',
                            fontFamily: 'ui-monospace, monospace',
                          }}
                        >
                          {m.chrom}:{m.pos.toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {searchCatalogHits.length > 0 && (
                  <div>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        padding: '2px 6px 4px 6px',
                      }}
                    >
                      {wt.searchSectionCatalog}
                    </span>
                    {searchCatalogHits.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleSelectCatalogHit(item)}
                        className="tabular-nums"
                        style={{
                          width: '100%',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '7px 8px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor:
                            selectedKey === item.key ? '#f8fafc' : 'transparent',
                          color: '#0f172a',
                          fontSize: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>
                          {item.variant.gene ? `${item.variant.gene} · ` : ''}
                          {item.variant.id}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#64748b',
                            fontFamily: 'ui-monospace, monospace',
                          }}
                        >
                          {item.variant.chrom}:{item.variant.pos.toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {!parsedCoordSearch &&
                  searchClinvarHits.length === 0 &&
                  searchCatalogHits.length === 0 && (
                    <div
                      style={{
                        padding: '10px 8px',
                        fontSize: '12px',
                        color: '#64748b',
                        textAlign: 'center',
                      }}
                    >
                      {wt.searchNoResults}
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* Active Decoded Variant Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0,
              width: '100%',
            }}
          >
            {session && (
              <span
                className="tabular-nums"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '5px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#334155',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {session.header.reference_build}
              </span>
            )}

            {catalogLoading ? (
              <span
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.locus.loadingCatalog}
              </span>
            ) : catalogError ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  color: '#be123c',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>{catalogError}</span>
              </span>
            ) : catalogItems.length > 0 ? (
              <select
                data-testid="active-variant-select"
                aria-label={
                  sourceMode === 'vault' ? t.locus.activeVaultLocus : t.locus.activeLocus
                }
                value={current?.key ?? ''}
                onChange={(e) => {
                  setNavigatorJumpTarget(null)
                  setSelectedKey(e.target.value)
                }}
                style={{
                  flex: 1,
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  backgroundColor: '#ffffff',
                  fontWeight: 600,
                  color: '#0f172a',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {catalogItems.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.variant.gene ? `${item.variant.gene} · ` : ''}
                    {item.variant.id} ({item.variant.chrom}:
                    {item.variant.pos.toLocaleString()} {item.variant.ref}&gt;
                    {item.variant.alt})
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {t.locus.catalogEmpty}
              </span>
            )}
          </div>
        </div>

        {/* Function + Plausible Clinical Summary Bento (Navigator Tab) */}
        {activeTab === 'navigator' && (
          <ClinicalSummaryBento
            lang={lang}
            sourceMode={sourceMode}
            session={session}
            catalogItems={catalogItems}
            savingsPct={savingsPct}
            intersectionReport={intersectionReport}
            intersectionLoading={intersectionLoading}
            onOpenIntersectionTab={() => setActiveTab('intersection')}
            onTriggerUpload={() => fileInputRef.current?.click()}
          />
        )}

        {/* TAB 0: Multi-scale Whole-Genome Navigator */}
        {activeTab === 'navigator' && (
          <div style={{ marginBottom: '20px' }}>
            <GenomeNavigator
              lang={lang}
              sourceMode={sourceMode}
              opfsFilename={activeOpfsFilename}
              containerAssembly={session?.containerAssembly ?? 'GRCh38'}
              catalogItems={catalogItems}
              selectedCatalogKey={selectedKey}
              onSelectCatalogKey={(key) => {
                setNavigatorJumpTarget(null)
                setSelectedKey(key)
              }}
              externalJumpTarget={navigatorJumpTarget}
              onExternalJumpConsumed={(seq) => {
                setNavigatorJumpTarget((prev) => (prev?.seq === seq ? null : prev))
              }}
            />
          </div>
        )}

        {/* TAB 0B: Personal DNA <-> Public ClinVar Zstd Intersection Report */}
        {activeTab === 'intersection' && (
          <ClinVarIntersectionPanel
            lang={lang}
            hasVaultFile={sourceMode === 'vault'}
            loading={intersectionLoading}
            error={intersectionError}
            report={intersectionReport}
            onTriggerUpload={() => fileInputRef.current?.click()}
            onInspectInNavigator={(match) => {
              const matchedItem = catalogItems.find(
                (item) =>
                  item.variant.chrom === match.chrom &&
                  (item.variant.pos === match.personal_pos ||
                    item.variant.pos === match.pos ||
                    (Boolean(match.rsid) && item.variant.id === match.rsid))
              )
              if (matchedItem) {
                setSelectedKey(matchedItem.key)
              }
              setActiveTab('navigator')
              setNavigatorJumpTarget((prev) => ({
                chrom: match.chrom,
                pos: match.pos,
                seq: (prev?.seq ?? 0) + 1,
              }))
            }}
          />
        )}

        {/* TAB 1: Data Viewer (Real .plasmid Byte-Range & Merkle Verification) */}
        {activeTab === 'stream' && (
          <div>
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '18px',
                marginBottom: '24px',
                backgroundColor: '#ffffff',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h2
                    className="cjk-keep"
                    style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      margin: '0 0 4px 0',
                      color: '#0f172a',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {t.stream.title}
                  </h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>{t.stream.desc}</p>
                </div>
                {savingsPct !== null && current && session && (
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      borderRadius: '9999px',
                      wordBreak: 'break-word',
                    }}
                  >
                    {t.stream.savingsPrefix}: {savingsPct}% (
                    {current.bytesTransferred.toLocaleString()} B /{' '}
                    {session.totalFileSize.toLocaleString()} B)
                  </span>
                )}
              </div>

              {!current || !session ? (
                <div style={{ padding: '16px', fontSize: '13px', color: '#64748b' }}>
                  {catalogLoading
                    ? t.locus.loadingCatalog
                    : catalogError || t.locus.catalogEmpty}
                </div>
              ) : (
                <>
                  {/* Decoded Variant Summary */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 16px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      marginBottom: '18px',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                          {current.variant.gene || current.variant.chrom}
                        </span>
                        {current.variant.clinvar && (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              backgroundColor:
                                current.variant.score >= 10 ? '#fff1f2' : '#fff7ed',
                              color: current.variant.score >= 10 ? '#be123c' : '#9a3412',
                              border:
                                current.variant.score >= 10
                                  ? '1px solid #fecdd3'
                                  : '1px solid #fed7aa',
                              borderRadius: '9999px',
                              fontWeight: 700,
                              wordBreak: 'break-word',
                            }}
                          >
                            {localizeClinicalSignificance(current.variant.clinvar, lang)}
                          </span>
                        )}
                      </div>
                      <div
                        className="tabular-nums"
                        style={{
                          fontSize: '12px',
                          color: '#475569',
                          marginTop: '4px',
                          fontFamily: 'ui-monospace, monospace',
                        }}
                      >
                        {current.variant.id} · {current.variant.chrom}:
                        {current.variant.pos.toLocaleString()} ({current.variant.ref} &gt;{' '}
                        {current.variant.alt})
                      </div>
                    </div>

                    <div className="tabular-nums" style={{ fontSize: '12px', color: '#475569' }}>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                        FILTER={current.variant.filter}
                        {current.variant.qual !== null ? ` · QUAL=${current.variant.qual}` : ''}
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {t.stream.payloadBadge(current.entry.payload_bytes)}
                      </span>
                    </div>
                  </div>

                  {/* Real Data Range Specifications */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                      gap: '12px',
                      marginBottom: '20px',
                    }}
                  >
                    <div
                      style={{
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                        {t.stream.dataRange}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{
                          fontSize: '12px',
                          fontFamily: 'ui-monospace, monospace',
                          fontWeight: 600,
                          wordBreak: 'break-all',
                          color: '#0f172a',
                        }}
                      >
                        {current.byteRangeHeader}
                      </span>
                    </div>

                    <div
                      style={{
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                        {t.stream.indexOffset}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{
                          fontSize: '12px',
                          fontFamily: 'ui-monospace, monospace',
                          fontWeight: 600,
                          color: '#0f172a',
                        }}
                      >
                        {current.leaf
                          ? `offset=${current.leaf.leaf_offset} len=${current.leaf.leaf_length}B`
                          : `offset=${session.header.index_offset} len=${session.header.index_length}B`}
                      </span>
                    </div>

                    <div
                      style={{
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                        {t.stream.dataBlocks}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{
                          fontSize: '12px',
                          fontFamily: 'ui-monospace, monospace',
                          fontWeight: 600,
                          color: '#0f172a',
                        }}
                      >
                        #{current.chunkIndices.join(', #')} (
                        {session.header.chunk_size.toLocaleString()} B)
                      </span>
                    </div>

                    <div
                      style={{
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                        {t.stream.license}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#166534' }}>
                        {session.metadata.license || t.stream.unspecifiedLicense}
                      </span>
                    </div>
                  </div>

                  {/* Real Cryptographic Merkle Root Verification Card */}
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '16px',
                      backgroundColor: '#f8fafc',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                          {t.stream.integrityTitle}
                        </span>
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: '12px',
                            fontFamily: 'ui-monospace, monospace',
                            fontWeight: 600,
                            wordBreak: 'break-all',
                            overflowWrap: 'anywhere',
                            display: 'block',
                            color: '#0f172a',
                          }}
                        >
                          {t.stream.headerRootPrefix}: 0x{session.header.root_hash_hex}
                        </span>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '6px',
                            marginTop: '6px',
                          }}
                        >
                          {verifyError ? (
                            <>
                              <ShieldAlert
                                size={14}
                                color="#be123c"
                                style={{ flexShrink: 0, marginTop: '2px' }}
                              />
                              <span
                                style={{
                                  fontSize: '11px',
                                  color: '#be123c',
                                  fontWeight: 600,
                                  wordBreak: 'break-word',
                                }}
                              >
                                {verifyError}
                              </span>
                            </>
                          ) : merkleResult ? (
                            merkleResult.verified ? (
                              <>
                                <CheckCircle2
                                  size={14}
                                  color="#16a34a"
                                  style={{ flexShrink: 0, marginTop: '2px' }}
                                />
                                <span
                                  className="tabular-nums"
                                  style={{
                                    fontSize: '11px',
                                    color: '#166534',
                                    fontWeight: 600,
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {t.stream.verified} ({merkleResult.total_chunks},{' '}
                                  {merkleResult.verified_bytes.toLocaleString()} B,{' '}
                                  {merkleElapsedMs} ms)
                                </span>
                              </>
                            ) : (
                              <>
                                <ShieldAlert
                                  size={14}
                                  color="#be123c"
                                  style={{ flexShrink: 0, marginTop: '2px' }}
                                />
                                <span
                                  style={{
                                    fontSize: '11px',
                                    color: '#be123c',
                                    fontWeight: 600,
                                    wordBreak: 'break-all',
                                  }}
                                >
                                  {t.stream.failed} (0x{merkleResult.calculated_root_hex})
                                </span>
                              </>
                            )
                          ) : (
                            <span
                              className="tabular-nums"
                              style={{
                                fontSize: '11px',
                                color: '#475569',
                                fontWeight: 600,
                                wordBreak: 'break-all',
                              }}
                            >
                              {t.stream.pending} · #{current.chunkHashes[0]?.chunk_index ?? 0}{' '}
                              SHA-256: {current.chunkHashes[0]?.sha256_hex.slice(0, 20) ?? '—'}…
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleVerifyMerkle()}
                        disabled={verifying}
                        style={{
                          padding: '8px 14px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          cursor: verifying ? 'wait' : 'pointer',
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {verifying ? t.stream.verifyingBtn : t.stream.verifyBtn}
                      </button>
                    </div>

                    {merkleResult && (
                      <div
                        style={{
                          marginTop: '14px',
                          paddingTop: '12px',
                          borderTop: '1px solid #e2e8f0',
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#334155',
                            display: 'block',
                            marginBottom: '6px',
                            wordBreak: 'break-all',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {t.stream.chunkDigestsTitle} ({t.stream.computedRootPrefix}: 0x
                          {merkleResult.calculated_root_hex})
                        </span>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                            gap: '6px',
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: '11px',
                            color: '#475569',
                          }}
                        >
                          {merkleResult.chunk_hashes.map((hash, idx) => (
                            <div
                              key={idx}
                              className="tabular-nums"
                              style={{
                                backgroundColor: '#ffffff',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                                wordBreak: 'break-all',
                              }}
                            >
                              {t.stream.chunkPrefix} #{idx}: {hash.slice(0, 24)}…
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Assembly Liftover (Responsive Grid + Real WASM LiftoverEngine & CoordinateGuard) */}
        {activeTab === 'liftover' && (
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px',
              backgroundColor: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '18px',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <h2
                  className="cjk-keep"
                  style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    margin: '0 0 4px 0',
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {t.liftover.title}
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                  {t.liftover.desc}
                </p>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                <input
                  type="checkbox"
                  checked={simulateAdversarialDrift}
                  onChange={(e) => setSimulateAdversarialDrift(e.target.checked)}
                />
                <span
                  style={{
                    fontWeight: 600,
                    color: simulateAdversarialDrift ? '#be123c' : '#475569',
                  }}
                >
                  {t.liftover.testToggle}
                </span>
              </label>
            </div>

            {!current ? (
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                {catalogLoading ? t.locus.loadingCatalog : catalogError || t.locus.catalogEmpty}
              </div>
            ) : (
              <>
                {guardError ? (
                  <div
                    style={{
                      padding: '14px 16px',
                      backgroundColor: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: '8px',
                      marginBottom: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <ShieldAlert
                        size={18}
                        color="#be123c"
                        style={{ marginTop: '2px', flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <h3
                          style={{
                            margin: '0 0 4px 0',
                            fontSize: '14px',
                            fontWeight: 700,
                            color: '#9f1239',
                          }}
                        >
                          {t.liftover.warningTitle}
                        </h3>
                        <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#be123c' }}>
                          {t.liftover.warningDesc}
                        </p>
                        <code
                          style={{
                            display: 'block',
                            fontSize: '11px',
                            color: '#881337',
                            backgroundColor: '#ffe4e6',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {guardError}
                        </code>
                      </div>
                    </div>
                  </div>
                ) : liftoverError ? (
                  <div
                    style={{
                      padding: '14px 16px',
                      backgroundColor: '#fff7ed',
                      border: '1px solid #fed7aa',
                      borderRadius: '8px',
                      marginBottom: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <ShieldCheck
                        size={18}
                        color="#9a3412"
                        style={{ marginTop: '2px', flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <h3
                          style={{
                            margin: '0 0 4px 0',
                            fontSize: '14px',
                            fontWeight: 700,
                            color: '#9a3412',
                          }}
                        >
                          {t.liftover.unmappedNoticeTitle}
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#c2410c' }}>
                          {t.liftover.unmappedNoticeDesc}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '14px 16px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      marginBottom: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <ShieldCheck
                        size={18}
                        color="#16a34a"
                        style={{ marginTop: '2px', flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <h3
                          style={{
                            margin: '0 0 4px 0',
                            fontSize: '14px',
                            fontWeight: 700,
                            color: '#166534',
                          }}
                        >
                          {t.liftover.verifiedTitle}
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#15803d' }}>
                          {t.liftover.verifiedDesc}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="plasmid-liftover-grid">
                  <div
                    style={{
                      padding: '14px 16px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#64748b',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      {session?.containerAssembly === 'GRCh37'
                        ? t.liftover.liftedGrch38Build
                        : t.liftover.sourceBuild}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        fontFamily: 'ui-monospace, monospace',
                        wordBreak: 'break-all',
                        color: guardError ? '#be123c' : '#0f172a',
                      }}
                    >
                      {guardError
                        ? t.liftover.blockedLabel
                        : liftoverResult
                          ? `${liftoverResult.lifted_chrom}:${liftoverResult.lifted_pos.toLocaleString()}`
                          : t.liftover.unmappedLabel}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#64748b',
                        display: 'block',
                        marginTop: '4px',
                      }}
                    >
                      {t.liftover.allelesPrefix}: {current.variant.ref} &gt;{' '}
                      {current.variant.alt}
                    </span>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <ArrowRightLeft size={18} color="#64748b" />
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: '11px',
                        color: '#64748b',
                        display: 'block',
                        marginTop: '4px',
                      }}
                    >
                      {t.liftover.delta}:{' '}
                      {!guardError && !liftoverError && liftoverResult
                        ? `${Math.abs(
                            current.variant.pos - liftoverResult.lifted_pos
                          ).toLocaleString()} bp`
                        : '—'}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '14px 16px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#64748b',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      {session?.containerAssembly === 'GRCh37'
                        ? t.liftover.sourceGrch37Build
                        : t.liftover.targetBuild}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        fontFamily: 'ui-monospace, monospace',
                        wordBreak: 'break-all',
                        color: '#0f172a',
                      }}
                    >
                      {current.variant.chrom}:{current.variant.pos.toLocaleString()}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: guardError ? '#be123c' : '#166534',
                        fontWeight: 600,
                        display: 'block',
                        marginTop: '4px',
                      }}
                    >
                      {guardError ? t.liftover.blockedNote : t.liftover.deltaNote}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: Clinical Records & Decoded Annotations */}
        {activeTab === 'wiki' && (
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px',
              backgroundColor: '#ffffff',
            }}
          >
            {!current ? (
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                {catalogLoading ? t.locus.loadingCatalog : catalogError || t.locus.catalogEmpty}
              </div>
            ) : (
              <>
                <div
                  style={{
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '14px',
                    marginBottom: '18px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                      {current.variant.gene || current.variant.chrom} · {current.variant.id} (
                      {current.variant.ref}&gt;{current.variant.alt})
                    </h2>
                    {current.variant.id.startsWith('rs') && (
                      <a
                        href={`https://www.ncbi.nlm.nih.gov/snp/${current.variant.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                          color: '#2563eb',
                          fontFamily: 'ui-monospace, monospace',
                          textDecoration: 'none',
                        }}
                      >
                        {t.wiki.reference}: {current.variant.id}
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {current.variant.clinvar && (
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          backgroundColor:
                            current.variant.score >= 10 ? '#fff1f2' : '#fff7ed',
                          color: current.variant.score >= 10 ? '#be123c' : '#9a3412',
                          border:
                            current.variant.score >= 10
                              ? '1px solid #fecdd3'
                              : '1px solid #fed7aa',
                          borderRadius: '9999px',
                          fontWeight: 600,
                          wordBreak: 'break-word',
                        }}
                      >
                        {t.wiki.clinicalSignificance}:{' '}
                        {localizeClinicalSignificance(current.variant.clinvar, lang)}
                      </span>
                    )}
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#334155',
                        borderRadius: '9999px',
                        fontWeight: 600,
                        fontFamily: 'ui-monospace, monospace',
                      }}
                    >
                      {current.variant.chrom}:{current.variant.pos.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Real Decoded VCF INFO Table */}
                <div style={{ marginBottom: '20px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#0f172a',
                      display: 'block',
                      marginBottom: '8px',
                    }}
                  >
                    {t.wiki.vcfInfoTitle}
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
                      gap: '10px',
                    }}
                  >
                    {Object.entries(current.variant.info).map(([k, v]) => (
                      <div
                        key={k}
                        className="tabular-nums"
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: '12px',
                          wordBreak: 'break-all',
                        }}
                      >
                        <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>
                          INFO.{k}
                        </span>
                        <strong style={{ color: '#0f172a' }}>{v}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Real Decoded Annotation Entries */}
                <div>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#0f172a',
                      display: 'block',
                      marginBottom: '8px',
                    }}
                  >
                    {t.wiki.annotationsTitle}
                  </span>
                  {current.annotations.length === 0 ? (
                    <div
                      style={{
                        padding: '14px 16px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#475569',
                      }}
                    >
                      {t.wiki.noAnnotationBundled}
                    </div>
                  ) : (
                    current.annotations.map((ann, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '16px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          marginBottom: '12px',
                        }}
                      >
                        <h3
                          style={{
                            margin: '0 0 8px 0',
                            fontSize: '15px',
                            fontWeight: 700,
                            color: '#0f172a',
                          }}
                        >
                          {ann.title}
                        </h3>
                        <p
                          style={{
                            margin: '0 0 12px 0',
                            fontSize: '13px',
                            color: '#334155',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {ann.content}
                        </p>

                        {ann.acmg_criteria.length > 0 && (
                          <div style={{ marginBottom: '12px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#0f172a',
                                display: 'block',
                                marginBottom: '6px',
                              }}
                            >
                              {t.wiki.acmgCriteria}
                            </span>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {ann.acmg_criteria.map((tag) => (
                                <span
                                  key={tag}
                                  style={{
                                    fontSize: '11px',
                                    padding: '3px 8px',
                                    backgroundColor: '#eff6ff',
                                    color: '#1d4ed8',
                                    border: '1px solid #bfdbfe',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {ann.pubmed_ids.length > 0 && (
                          <div>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#0f172a',
                                display: 'block',
                                marginBottom: '6px',
                              }}
                            >
                              {t.wiki.citationsTitle} ({t.wiki.citationsNote})
                            </span>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {ann.pubmed_ids.map((pmid) => (
                                <a
                                  key={pmid}
                                  href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tabular-nums"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '12px',
                                    color: '#2563eb',
                                    textDecoration: 'none',
                                    padding: '4px 10px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    backgroundColor: '#ffffff',
                                  }}
                                >
                                  <span>PMID: {pmid}</span>
                                  <ExternalLink size={12} />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 4: Live WebRTC P2P Merkle Swarm & Privacy Integrity */}
        {activeTab === 'swarm' && (
          <SwarmPanel
            lang={lang}
            session={session}
            activeVariantChunkIndex={current?.chunkIndices[0] ?? null}
            snapshot={swarmSnapshot}
          />
        )}

        {/* TAB 5: Data Sources & Privacy Architecture */}
        {activeTab === 'governance' && (
          <div>
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '18px',
                marginBottom: '24px',
                backgroundColor: '#ffffff',
              }}
            >
              <div style={{ marginBottom: '18px' }}>
                <h2
                  className="cjk-keep"
                  style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    margin: '0 0 4px 0',
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {t.governance.title}
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                  {t.governance.desc}
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                  gap: '14px',
                  marginBottom: '20px',
                }}
              >
                {(
                  [
                    {
                      title: t.governance.tier1Title,
                      status: t.governance.tier1Status,
                      desc: t.governance.tier1Desc,
                      color: '#166534',
                      bg: '#f0fdf4',
                      border: '#bbf7d0',
                    },
                    {
                      title: t.governance.tier2Title,
                      status: t.governance.tier2Status,
                      desc: t.governance.tier2Desc,
                      color: '#1d4ed8',
                      bg: '#eff6ff',
                      border: '#bfdbfe',
                    },
                    {
                      title: t.governance.tier3Title,
                      status: t.governance.tier3Status,
                      desc: t.governance.tier3Desc,
                      color: '#334155',
                      bg: '#f1f5f9',
                      border: '#e2e8f0',
                    },
                    {
                      title: t.governance.tier4Title,
                      status: t.governance.tier4Status,
                      desc: t.governance.tier4Desc,
                      color: '#166534',
                      bg: '#f0fdf4',
                      border: '#bbf7d0',
                    },
                  ] as const
                ).map((tier) => (
                  <div
                    key={tier.title}
                    style={{
                      padding: '15px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      backgroundColor: '#f8fafc',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginBottom: '6px',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                        {tier.title}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: tier.color,
                          backgroundColor: tier.bg,
                          border: `1px solid ${tier.border}`,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {tier.status}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        color: '#475569',
                        lineHeight: 1.5,
                      }}
                    >
                      {tier.desc}
                    </p>
                  </div>
                ))}
              </div>

              <div
                style={{
                  padding: '15px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  marginBottom: '14px',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0f172a',
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  {t.governance.attributionsTitle}
                </span>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '18px',
                    fontSize: '12px',
                    color: '#475569',
                    lineHeight: 1.7,
                  }}
                >
                  <li>{t.governance.gnomadAttr}</li>
                  <li>{t.governance.cpicAttr}</li>
                </ul>
              </div>

              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0f172a',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  {t.governance.statementTitle}
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    color: '#475569',
                    lineHeight: 1.5,
                  }}
                >
                  {t.governance.statementDesc}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mobile / Tablet Footer Academic Notice (<1200px) */}
        <footer
          className="plasmid-mobile-only"
          style={{
            marginTop: '20px',
            padding: '14px',
            borderRadius: '10px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            fontSize: '11px',
            color: '#475569',
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '3px' }}>
            {t.disclaimer.bannerTitle}
          </div>
          <div>{t.disclaimer.bannerDesc}</div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px solid #e2e8f0',
              color: '#64748b',
            }}
          >
            <span>© 2026 EntropyParadox Genomics</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <a
                href="https://github.com/epgeno/plasmid"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#475569', fontWeight: 600 }}
              >
                GitHub
              </a>
              <a
                href="https://plasmid.wiki"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#475569', fontWeight: 600 }}
              >
                plasmid.wiki
              </a>
            </div>
          </div>
        </footer>
      </main>

      {/* ===================================================================
          3. RIGHT CONTEXT & OPFS AIR-GAP VAULT RAIL (>=1200px)
             & COLLAPSIBLE OPFS VAULT ACCORDION (<1200px)
         =================================================================== */}
      <aside className="plasmid-right-rail">
        <section
          data-testid="local-vault-panel"
          style={{
            padding: isCompactViewport && !showVaultBody ? '8px 12px' : '14px',
            backgroundColor: '#ffffff',
            border: sourceMode === 'vault' ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
            minWidth: 0,
          }}
        >
          {/* Hidden File Input ALWAYS Mounted for Desktop & Mobile */}
          <input
            ref={fileInputRef}
            data-testid="vault-file-input"
            type="file"
            accept=".vcf,.vcf.gz,.vcf.bgz,.plasmid,.txt,.txt.gz,.tsv,.tsv.gz"
            onChange={(e) => {
              const chosen = e.target.files?.[0]
              if (chosen) {
                void handleImportVaultFile(chosen)
              }
            }}
            style={{ display: 'none' }}
          />

          {/* Compact Mobile Accordion Header (<1200px) */}
          {isCompactViewport ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                minWidth: 0,
              }}
            >
              <button
                type="button"
                data-testid="mobile-vault-toggle"
                aria-expanded={showVaultBody}
                onClick={() => setMobileVaultExpanded((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  backgroundColor: 'transparent',
                  padding: '2px 0',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <HardDrive
                  size={15}
                  color={sourceMode === 'vault' ? '#16a34a' : '#2563eb'}
                  style={{ flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0f172a',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeVaultDisplayName}
                </span>
                {showVaultBody ? (
                  <ChevronUp size={14} color="#64748b" style={{ flexShrink: 0 }} />
                ) : (
                  <ChevronDown size={14} color="#64748b" style={{ flexShrink: 0 }} />
                )}
              </button>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button
                  type="button"
                  disabled={vaultImporting}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #0f172a',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: vaultImporting ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Upload size={12} />
                  <span>{wt.mobileVaultExpand}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Desktop Vault Rail Header (>=1200px) */
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                  <HardDrive
                    size={16}
                    color={sourceMode === 'vault' ? '#16a34a' : '#2563eb'}
                    style={{ flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    {t.vault.title}
                  </span>
                </div>

                {opfsQuota && (
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: '10px',
                      fontFamily: 'ui-monospace, monospace',
                      color: '#475569',
                      backgroundColor: '#f8fafc',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid #e2e8f0',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.vault.quotaLabel(opfsQuota.usageFormatted)}
                  </span>
                )}
              </div>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: '#f0fdf4',
                  color: '#166534',
                  border: '1px solid #bbf7d0',
                  marginBottom: '6px',
                  maxWidth: '100%',
                  wordBreak: 'break-word',
                }}
              >
                <ShieldCheck size={12} style={{ flexShrink: 0 }} />
                <span>{t.vault.badgeZeroNetwork}</span>
              </span>

              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: '#475569',
                  lineHeight: 1.45,
                }}
              >
                {t.vault.desc}
              </p>
            </div>
          )}

          {/* Expandable Vault Controls Body */}
          {showVaultBody && (
            <div style={{ marginTop: isCompactViewport ? '10px' : 0 }}>
              <div
                data-testid="vault-dropzone"
                onDragEnter={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDraggingVault(true)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDraggingVault(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDraggingVault(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDraggingVault(false)
                  const droppedFile = e.dataTransfer.files?.[0]
                  if (droppedFile) {
                    void handleImportVaultFile(droppedFile)
                  }
                }}
                onClick={() => {
                  if (!vaultImporting) {
                    fileInputRef.current?.click()
                  }
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: isDraggingVault
                    ? '2px dashed #2563eb'
                    : '1.5px dashed #cbd5e1',
                  backgroundColor: isDraggingVault ? '#eff6ff' : '#f8fafc',
                  cursor: vaultImporting ? 'wait' : 'pointer',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    minWidth: 0,
                  }}
                >
                  <Upload size={15} color="#2563eb" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#334155',
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                    }}
                  >
                    {vaultImporting
                      ? t.vault.importingStatus
                      : isDraggingVault
                        ? t.vault.dropzoneActive
                        : t.vault.dropzonePrompt}
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="vault-upload-btn"
                  disabled={vaultImporting}
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    borderRadius: '6px',
                    border: '1px solid #0f172a',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: vaultImporting ? 'wait' : 'pointer',
                  }}
                >
                  {t.vault.selectFileBtn}
                </button>
              </div>

              {vaultError && (
                <div
                  role="alert"
                  data-testid="vault-error-banner"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginTop: '10px',
                    padding: '10px 12px',
                    backgroundColor: '#fff1f2',
                    border: '1px solid #fecdd3',
                    borderRadius: '8px',
                    color: '#be123c',
                    fontSize: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      minWidth: 0,
                      flex: '1 1 180px',
                    }}
                  >
                    <AlertTriangle
                      size={15}
                      color="#be123c"
                      style={{ flexShrink: 0, marginTop: '1px' }}
                    />
                    <span style={{ wordBreak: 'break-word' }}>
                      <strong>{t.vault.uploadErrorPrefix}</strong>{' '}
                      {formatVaultErrorMessage(vaultError, lang)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVaultError(null)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #fecdd3',
                      backgroundColor: '#ffffff',
                      color: '#be123c',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t.vault.dismissBtn}
                  </button>
                </div>
              )}

              {/* Data Source Switcher */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginTop: '12px',
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#64748b',
                  }}
                >
                  {t.vault.sourceLabel}
                </span>

                <button
                  type="button"
                  data-testid="source-public-demo"
                  onClick={() => {
                    if (sourceMode !== 'public') {
                      void activateDataSource('public', DEFAULT_OPFS_FILENAME)
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: sourceMode === 'public' ? 700 : 500,
                    border:
                      sourceMode === 'public' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: sourceMode === 'public' ? '#eff6ff' : '#ffffff',
                    color: sourceMode === 'public' ? '#1d4ed8' : '#334155',
                    cursor: 'pointer',
                    textAlign: 'left',
                    wordBreak: 'break-word',
                  }}
                >
                  <span>{t.vault.publicDemoSource}</span>
                </button>

                {vaultFiles.map((vf) => {
                  const isSelectedVault =
                    sourceMode === 'vault' && activeOpfsFilename === vf.opfsPath
                  return (
                    <div
                      key={vf.opfsPath}
                      style={{
                        display: 'flex',
                        alignItems: 'stretch',
                        borderRadius: '8px',
                        border: isSelectedVault
                          ? '1px solid #16a34a'
                          : '1px solid #cbd5e1',
                        backgroundColor: isSelectedVault ? '#f0fdf4' : '#ffffff',
                        maxWidth: '100%',
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        type="button"
                        data-testid="source-vault-file"
                        data-vault-name={vf.name}
                        title={vf.name}
                        onClick={() => {
                          if (!isSelectedVault) {
                            void activateDataSource('vault', vf.opfsPath)
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          flex: 1,
                          padding: '7px 10px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: isSelectedVault ? '#14532d' : '#0f172a',
                          fontSize: '12px',
                          fontWeight: isSelectedVault ? 700 : 600,
                          cursor: 'pointer',
                          minWidth: 0,
                          textAlign: 'left',
                        }}
                      >
                        <ShieldCheck
                          size={13}
                          color={isSelectedVault ? '#15803d' : '#64748b'}
                          style={{ flexShrink: 0 }}
                        />
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {vf.name}
                        </span>
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: '11px',
                            color: isSelectedVault ? '#166534' : '#64748b',
                            fontFamily: 'ui-monospace, monospace',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          ({opfs.formatBytes(vf.size)})
                        </span>
                      </button>
                      <button
                        type="button"
                        data-testid="delete-vault-file"
                        data-vault-name={vf.name}
                        aria-label={t.vault.deleteVaultAria(vf.name)}
                        title={t.vault.deleteVaultAria(vf.name)}
                        onClick={() => void handleDeleteVaultFile(vf)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 9px',
                          border: 'none',
                          borderLeft: isSelectedVault
                            ? '1px solid #bbf7d0'
                            : '1px solid #e2e8f0',
                          backgroundColor: 'transparent',
                          color: '#be123c',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <Trash2 size={13} />
                        {!isCompactViewport && <span>{t.vault.deleteVaultBtn}</span>}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Live ClinVar Intersection Summary Strip (Visible on Vault Upload in both Desktop & Mobile) */}
          {sourceMode === 'vault' && (intersectionLoading || intersectionReport) && (
            <div
              data-testid="vault-clinvar-summary"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '10px',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                minWidth: 0,
              }}
            >
              <div
                className="tabular-nums"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '7px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#14532d',
                  minWidth: 0,
                  lineHeight: 1.4,
                }}
              >
                <Stethoscope
                  size={14}
                  color="#15803d"
                  style={{ flexShrink: 0, marginTop: '1px' }}
                />
                <span style={{ wordBreak: 'break-word' }}>
                  {intersectionLoading
                    ? t.vault.intersectRunning
                    : intersectionReport
                      ? t.vault.intersectReadyBanner(
                          intersectionReport.matched_count,
                          intersectionReport.clinvar_variants_scanned
                        )
                      : ''}
                </span>
              </div>

              {intersectionReport && activeTab !== 'intersection' && (
                <button
                  type="button"
                  data-testid="open-clinvar-report-btn"
                  onClick={() => setActiveTab('intersection')}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #166534',
                    backgroundColor: '#166534',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {t.vault.openReportBtn}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Desktop-Only Right Rail Context Cards: Active Variant + Zero-Egress Security + Academic Notice */}
        <div
          className="plasmid-desktop-only"
          style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}
        >
          {/* Active Variant Quick Context */}
          {current && (
            <div
              style={{
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                {wt.contextActiveVariant}
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                  {current.variant.gene || current.variant.chrom} · {current.variant.id}
                </span>
                {current.variant.clinvar && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '9999px',
                      backgroundColor:
                        current.variant.score >= 10 ? '#fff1f2' : '#fff7ed',
                      color: current.variant.score >= 10 ? '#be123c' : '#9a3412',
                      border:
                        current.variant.score >= 10
                          ? '1px solid #fecdd3'
                          : '1px solid #fed7aa',
                      wordBreak: 'break-word',
                    }}
                  >
                    {localizeClinicalSignificance(current.variant.clinvar, lang)}
                  </span>
                )}
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: '12px',
                  fontFamily: 'ui-monospace, monospace',
                  color: '#475569',
                  marginTop: '4px',
                  wordBreak: 'break-all',
                }}
              >
                {current.variant.chrom}:{current.variant.pos.toLocaleString()} (
                {current.variant.ref}&gt;{current.variant.alt})
              </div>
            </div>
          )}

          {/* Security & Academic Research Notice */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              minWidth: 0,
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#0f172a',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                {wt.securityCardTitle}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    color: '#334155',
                    fontWeight: 500,
                  }}
                >
                  <ShieldCheck size={13} color="#16a34a" style={{ flexShrink: 0 }} />
                  <span>{wt.securityRfcAirgap}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    color: '#334155',
                    fontWeight: 500,
                  }}
                >
                  <Lock size={13} color="#2563eb" style={{ flexShrink: 0 }} />
                  <span>{wt.securityRfcPublic}</span>
                </div>
              </div>
            </div>

            <div
              style={{
                paddingTop: '10px',
                borderTop: '1px solid #f1f5f9',
                fontSize: '11px',
                color: '#64748b',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: '#334155', display: 'block', marginBottom: '2px' }}>
                {t.disclaimer.bannerTitle}
              </strong>
              <span>{t.disclaimer.bannerDesc}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
