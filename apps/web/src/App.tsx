import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Cpu,
  Layers,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  ArrowRightLeft,
  FileText,
  ExternalLink,
  Radio,
  Scale,
  Lock,
  Compass,
  AlertTriangle,
  Upload,
  HardDrive,
  Trash2,
  Stethoscope,
} from 'lucide-react'
import { SupportedLanguage, TRANSLATIONS } from './i18n'
import { GenomeNavigator } from './components/GenomeNavigator'
import { ClinVarIntersectionPanel } from './components/ClinVarIntersectionPanel'
import {
  plasmidContainerClient,
  DEFAULT_OPFS_FILENAME,
  type ContainerSession,
} from './services/plasmidContainerClient'
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
  DataSourceMode,
  LiftoverResult,
  WasmMerkleVerification,
} from './types/plasmid'

export default function App() {
  const initialVaultPath = opfs.getActiveVaultPath()
  const [lang, setLang] = useState<SupportedLanguage>('ko')
  const [activeTab, setActiveTab] = useState<
    | 'navigator'
    | 'intersection'
    | 'stream'
    | 'liftover'
    | 'wiki'
    | 'swarm'
    | 'governance'
  >('navigator')

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
    seq: number
  } | null>(null)

  const t = TRANSLATIONS[lang]

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

  // Synchronize <html lang="..."> with active UI language
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
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

  return (
    <div
      style={{
        minHeight: '100vh',
        maxWidth: '100%',
        overflowX: 'hidden',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        fontFamily: 'Pretendard, system-ui, sans-serif',
      }}
    >
      {/* Top Research Notice Banner */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '8px 16px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>
              {t.disclaimer.bannerTitle}:
            </span>
            <span>{t.disclaimer.bannerDesc}</span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
            {t.disclaimer.badgeLocal}
          </span>
        </div>
      </div>

      {/* Global Header */}
      <header
        style={{
          borderBottom: '1px solid #e2e8f0',
          padding: '16px',
          backgroundColor: '#ffffff',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                backgroundColor: '#2563eb',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Cpu size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: '#0f172a',
                  }}
                >
                  {t.header.title}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  v0.1.0
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                {t.header.subtitle}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', maxWidth: '100%' }}>
            <div
              style={{
                display: 'flex',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                overflow: 'hidden',
              }}
            >
              {(['ko', 'en', 'zh', 'ja'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: lang === l ? 700 : 500,
                    backgroundColor: lang === l ? '#0f172a' : '#ffffff',
                    color: lang === l ? '#ffffff' : '#64748b',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            <nav
              style={{
                display: 'flex',
                gap: '4px',
                backgroundColor: '#f1f5f9',
                padding: '4px',
                borderRadius: '8px',
                flexWrap: 'wrap',
                maxWidth: '100%',
              }}
            >
              {(
                [
                  { id: 'navigator', icon: Compass, label: t.header.tabs.navigator },
                  { id: 'intersection', icon: Stethoscope, label: t.header.tabs.intersection },
                  { id: 'stream', icon: Layers, label: t.header.tabs.viewer },
                  { id: 'liftover', icon: ArrowRightLeft, label: t.header.tabs.liftover },
                  { id: 'wiki', icon: FileText, label: t.header.tabs.wiki },
                  { id: 'swarm', icon: Radio, label: t.header.tabs.network },
                  { id: 'governance', icon: Scale, label: t.header.tabs.sources },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontWeight: active ? 700 : 500,
                      backgroundColor: active ? '#ffffff' : 'transparent',
                      color: active ? '#0f172a' : '#64748b',
                      border: 'none',
                      borderRadius: '6px',
                      boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
        {/* Local Personal Genome OPFS Air-Gap Vault & Data Source Switcher */}
        <section
          data-testid="local-vault-panel"
          style={{
            marginBottom: '16px',
            padding: '16px',
            backgroundColor: sourceMode === 'vault' ? '#f0fdf4' : '#f8fafc',
            border: sourceMode === 'vault' ? '1px solid #86efac' : '1px solid #e2e8f0',
            borderRadius: '10px',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '12px',
            }}
          >
            <div style={{ minWidth: 0, flex: '1 1 260px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <HardDrive
                  size={16}
                  color={sourceMode === 'vault' ? '#16a34a' : '#2563eb'}
                  style={{ flexShrink: 0 }}
                />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  {t.vault.title}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: '#dcfce7',
                    color: '#166534',
                    border: '1px solid #86efac',
                    wordBreak: 'break-word',
                  }}
                >
                  {t.vault.badgeZeroNetwork}
                </span>
              </div>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '12px',
                  color: '#475569',
                  lineHeight: 1.5,
                }}
              >
                {t.vault.desc}
              </p>
            </div>

            {opfsQuota && (
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'ui-monospace, monospace',
                  color: '#475569',
                  backgroundColor: '#ffffff',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.vault.quotaLabel(opfsQuota.usageFormatted)}
              </span>
            )}
          </div>

          {/* Drag-and-Drop Zone + File Input */}
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
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '8px',
              border: isDraggingVault
                ? '2px dashed #2563eb'
                : '1.5px dashed #cbd5e1',
              backgroundColor: isDraggingVault ? '#eff6ff' : '#ffffff',
              cursor: vaultImporting ? 'wait' : 'pointer',
              minWidth: 0,
            }}
          >
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: 0,
                flex: '1 1 200px',
              }}
            >
              <Upload size={16} color="#2563eb" style={{ flexShrink: 0 }} />
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
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
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #2563eb',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: vaultImporting ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
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
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginTop: '10px',
                padding: '10px 12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#991b1b',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <AlertTriangle size={15} color="#dc2626" style={{ flexShrink: 0 }} />
                <span style={{ wordBreak: 'break-word' }}>
                  <strong>{t.vault.uploadErrorPrefix}</strong> {vaultError}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setVaultError(null)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #fca5a5',
                  backgroundColor: '#ffffff',
                  color: '#991b1b',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t.vault.dismissBtn}
              </button>
            </div>
          )}

          {/* Source Switcher: Public Demo <-> Stored OPFS Vault Files */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              marginTop: '12px',
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#64748b',
                whiteSpace: 'nowrap',
              }}
            >
              {t.vault.sourceLabel}:
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: sourceMode === 'public' ? 700 : 500,
                border:
                  sourceMode === 'public' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                backgroundColor: sourceMode === 'public' ? '#eff6ff' : '#ffffff',
                color: sourceMode === 'public' ? '#1d4ed8' : '#334155',
                cursor: 'pointer',
                maxWidth: '100%',
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
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: '6px',
                    border: isSelectedVault
                      ? '1px solid #16a34a'
                      : '1px solid #cbd5e1',
                    backgroundColor: isSelectedVault ? '#dcfce7' : '#ffffff',
                    maxWidth: '100%',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    data-testid="source-vault-file"
                    data-vault-name={vf.name}
                    onClick={() => {
                      if (!isSelectedVault) {
                        void activateDataSource('vault', vf.opfsPath)
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: isSelectedVault ? '#14532d' : '#0f172a',
                      fontSize: '12px',
                      fontWeight: isSelectedVault ? 700 : 600,
                      cursor: 'pointer',
                      minWidth: 0,
                      wordBreak: 'break-all',
                    }}
                  >
                    <ShieldCheck
                      size={13}
                      color={isSelectedVault ? '#15803d' : '#64748b'}
                      style={{ flexShrink: 0 }}
                    />
                    <span>{vf.name}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: isSelectedVault ? '#166534' : '#64748b',
                        fontFamily: 'ui-monospace, monospace',
                        whiteSpace: 'nowrap',
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
                      padding: '6px 8px',
                      border: 'none',
                      borderLeft: isSelectedVault
                        ? '1px solid #86efac'
                        : '1px solid #e2e8f0',
                      backgroundColor: 'transparent',
                      color: '#dc2626',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={13} />
                    <span>{t.vault.deleteVaultBtn}</span>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Live ClinVar Intersection Summary Strip inside Vault Card */}
          {sourceMode === 'vault' && (intersectionLoading || intersectionReport) && (
            <div
              data-testid="vault-clinvar-summary"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                marginTop: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #86efac',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#14532d',
                  minWidth: 0,
                  flex: '1 1 240px',
                }}
              >
                <Stethoscope size={15} color="#15803d" style={{ flexShrink: 0 }} />
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
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #16a34a',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.vault.openReportBtn}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Active Container Variant Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span
              style={{
                fontSize: '11px',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
              }}
            >
              {sourceMode === 'vault' ? t.locus.activeVaultLocus : t.locus.activeLocus}
            </span>
            {catalogLoading ? (
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                {t.locus.loadingCatalog}
              </div>
            ) : catalogError ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  color: '#dc2626',
                  marginTop: '4px',
                }}
              >
                <AlertTriangle size={15} />
                <span>{catalogError}</span>
              </div>
            ) : current ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '2px',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  {current.variant.gene || current.variant.chrom} ({current.variant.id})
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#64748b',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {current.variant.chrom}:{current.variant.pos.toLocaleString()} (
                  {current.variant.ref} &gt; {current.variant.alt})
                </span>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                {t.locus.catalogEmpty}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              maxWidth: '100%',
            }}
          >
            {session && (
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                {t.locus.targetBuildPrefix}: {session.header.reference_build}
              </span>
            )}
            {catalogItems.length > 0 && (
              <select
                value={current?.key ?? ''}
                onChange={(e) => setSelectedKey(e.target.value)}
                style={{
                  maxWidth: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: '#ffffff',
                  fontWeight: 600,
                  color: '#0f172a',
                  cursor: 'pointer',
                }}
              >
                {catalogItems.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.variant.gene ? `${item.variant.gene} • ` : ''}
                    {item.variant.id} ({item.variant.chrom}:
                    {item.variant.pos.toLocaleString()} {item.variant.ref}&gt;
                    {item.variant.alt})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* TAB 0: Multi-scale Whole-Genome Navigator */}
        {activeTab === 'navigator' && (
          <div style={{ marginBottom: '24px' }}>
            <GenomeNavigator
              lang={lang}
              sourceMode={sourceMode}
              opfsFilename={activeOpfsFilename}
              containerAssembly={session?.containerAssembly ?? 'GRCh38'}
              catalogItems={catalogItems}
              selectedCatalogKey={selectedKey}
              onSelectCatalogKey={setSelectedKey}
              externalJumpTarget={navigatorJumpTarget}
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
            onInspectInNavigator={(chrom, pos) => {
              setActiveTab('navigator')
              setNavigatorJumpTarget((prev) => ({
                chrom,
                pos,
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
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '24px',
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
                <div>
                  <h2
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      margin: '0 0 4px 0',
                      color: '#0f172a',
                    }}
                  >
                    {t.stream.title}
                  </h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{t.stream.desc}</p>
                </div>
                {savingsPct !== null && current && session && (
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '4px 8px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      borderRadius: '4px',
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
                      padding: '16px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      marginBottom: '20px',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                          {current.variant.gene || current.variant.chrom}
                        </span>
                        {current.variant.clinvar && (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              backgroundColor:
                                current.variant.score >= 10 ? '#fee2e2' : '#fef3c7',
                              color: current.variant.score >= 10 ? '#b91c1c' : '#b45309',
                              borderRadius: '4px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {current.variant.clinvar}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginTop: '4px',
                          fontFamily: 'ui-monospace, monospace',
                        }}
                      >
                        {current.variant.id} • {current.variant.chrom}:
                        {current.variant.pos.toLocaleString()} ({current.variant.ref} &gt;{' '}
                        {current.variant.alt})
                      </div>
                    </div>

                    <div style={{ fontSize: '12px', color: '#475569' }}>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                        FILTER={current.variant.filter}
                        {current.variant.qual !== null ? ` • QUAL=${current.variant.qual}` : ''}
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
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '16px',
                      marginBottom: '24px',
                    }}
                  >
                    <div
                      style={{
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                        {t.stream.dataRange}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontFamily: 'ui-monospace, monospace',
                          fontWeight: 600,
                          wordBreak: 'break-all',
                        }}
                      >
                        {current.byteRangeHeader}
                      </span>
                    </div>

                    <div
                      style={{
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                        {t.stream.indexOffset}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontFamily: 'ui-monospace, monospace',
                          fontWeight: 600,
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
                        borderRadius: '6px',
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                        {t.stream.dataBlocks}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontFamily: 'ui-monospace, monospace',
                          fontWeight: 600,
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
                        borderRadius: '6px',
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                        {t.stream.license}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a' }}>
                        {session.metadata.license || t.stream.unspecifiedLicense}
                      </span>
                    </div>
                  </div>

                  {/* Real Cryptographic Merkle Root Verification Card */}
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
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
                          style={{
                            fontSize: '12px',
                            fontFamily: 'ui-monospace, monospace',
                            fontWeight: 600,
                            wordBreak: 'break-all',
                            overflowWrap: 'anywhere',
                            display: 'block',
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
                              <ShieldAlert size={14} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                              <span
                                style={{
                                  fontSize: '11px',
                                  color: '#dc2626',
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
                                <CheckCircle2 size={14} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span
                                  style={{
                                    fontSize: '11px',
                                    color: '#16a34a',
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
                                <ShieldAlert size={14} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span
                                  style={{
                                    fontSize: '11px',
                                    color: '#dc2626',
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
                              style={{
                                fontSize: '11px',
                                color: '#475569',
                                fontWeight: 600,
                                wordBreak: 'break-all',
                              }}
                            >
                              {t.stream.pending} • #{current.chunkHashes[0]?.chunk_index ?? 0}{' '}
                              SHA-256: {current.chunkHashes[0]?.sha256_hex.slice(0, 20) ?? '—'}…
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => void handleVerifyMerkle()}
                        disabled={verifying}
                        style={{
                          padding: '8px 14px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
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
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: '6px',
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: '11px',
                            color: '#475569',
                          }}
                        >
                          {merkleResult.chunk_hashes.map((hash, idx) => (
                            <div
                              key={idx}
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
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '20px',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    margin: '0 0 4px 0',
                    color: '#0f172a',
                  }}
                >
                  {t.liftover.title}
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
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
                    color: simulateAdversarialDrift ? '#dc2626' : '#64748b',
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
                      padding: '16px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      marginBottom: '24px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <ShieldAlert
                        size={18}
                        color="#dc2626"
                        style={{ marginTop: '2px', flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <h3
                          style={{
                            margin: '0 0 4px 0',
                            fontSize: '14px',
                            fontWeight: 700,
                            color: '#991b1b',
                          }}
                        >
                          {t.liftover.warningTitle}
                        </h3>
                        <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#b91c1c' }}>
                          {t.liftover.warningDesc}
                        </p>
                        <code
                          style={{
                            display: 'block',
                            fontSize: '11px',
                            color: '#7f1d1d',
                            backgroundColor: '#fee2e2',
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
                      padding: '16px',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '6px',
                      marginBottom: '24px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <ShieldCheck
                        size={18}
                        color="#d97706"
                        style={{ marginTop: '2px', flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <h3
                          style={{
                            margin: '0 0 4px 0',
                            fontSize: '14px',
                            fontWeight: 700,
                            color: '#92400e',
                          }}
                        >
                          {t.liftover.unmappedNoticeTitle}
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#b45309' }}>
                          {t.liftover.unmappedNoticeDesc}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      marginBottom: '24px',
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
                      padding: '16px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
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
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        fontFamily: 'ui-monospace, monospace',
                        wordBreak: 'break-all',
                        color: guardError ? '#dc2626' : '#0f172a',
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
                    <ArrowRightLeft size={20} color="#64748b" />
                    <span
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
                      padding: '16px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
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
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        fontFamily: 'ui-monospace, monospace',
                        wordBreak: 'break-all',
                      }}
                    >
                      {current.variant.chrom}:{current.variant.pos.toLocaleString()}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: guardError ? '#dc2626' : '#16a34a',
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
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            {!current ? (
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                {catalogLoading ? t.locus.loadingCatalog : catalogError || t.locus.catalogEmpty}
              </div>
            ) : (
              <>
                <div
                  style={{
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '16px',
                    marginBottom: '20px',
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
                    <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                      {current.variant.gene || current.variant.chrom} • {current.variant.id} (
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
                            current.variant.score >= 10 ? '#fee2e2' : '#fef3c7',
                          color: current.variant.score >= 10 ? '#991b1b' : '#b45309',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        {t.wiki.clinicalSignificance}: {current.variant.clinvar}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontFamily: 'ui-monospace, monospace',
                      }}
                    >
                      {current.variant.chrom}:{current.variant.pos.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Real Decoded VCF INFO Table */}
                <div style={{ marginBottom: '24px' }}>
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
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {Object.entries(current.variant.info).map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
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
                        borderRadius: '6px',
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
                          borderRadius: '6px',
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

        {/* TAB 4: Container Merkle Geometry & Privacy Architecture */}
        {activeTab === 'swarm' && (
          <div>
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '24px',
              }}
            >
              <div style={{ marginBottom: '20px' }}>
                <h2
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    margin: '0 0 4px 0',
                    color: '#0f172a',
                  }}
                >
                  {t.swarm.title}
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{t.swarm.desc}</p>
              </div>

              {session && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px',
                  }}
                >
                  <div
                    style={{
                      padding: '14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#0f172a',
                        display: 'block',
                      }}
                    >
                      {t.swarm.containerPackTitle}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontFamily: 'ui-monospace, monospace',
                        color: '#475569',
                        display: 'block',
                        marginTop: '4px',
                      }}
                    >
                      {(session.totalFileSize / 1024).toFixed(2)} KB •{' '}
                      {session.header.total_chunks} ×{' '}
                      {(session.header.chunk_size / 1024).toFixed(0)} KB
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#0f172a',
                        display: 'block',
                      }}
                    >
                      {t.swarm.directoryArchTitle}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontFamily: 'ui-monospace, monospace',
                        color: '#475569',
                        display: 'block',
                        marginTop: '4px',
                      }}
                    >
                      {session.header.is_hierarchical
                        ? t.swarm.hierarchicalDesc(session.rootLeaves.length)
                        : t.swarm.flatDesc}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#0f172a',
                        display: 'block',
                      }}
                    >
                      {t.swarm.generatorBuildTitle}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontFamily: 'ui-monospace, monospace',
                        color: '#475569',
                        display: 'block',
                        marginTop: '4px',
                      }}
                    >
                      {session.metadata.generator || 'plasmid'} •{' '}
                      {session.header.reference_build}
                    </span>
                  </div>
                </div>
              )}

              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      {t.swarm.privacyTitle}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#2563eb',
                      backgroundColor: '#eff6ff',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.swarm.privacyBadge}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  {t.swarm.privacyDesc}
                </p>
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>
                    ✓ {t.swarm.privacyStatusTitle}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#475569',
                      display: 'block',
                      marginTop: '2px',
                    }}
                  >
                    {t.swarm.privacyStatusDesc}
                  </span>
                </div>
              </div>

              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
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
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      {t.swarm.integrityTitle}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: '#64748b',
                        display: 'block',
                        marginTop: '2px',
                      }}
                    >
                      {t.swarm.integrityDesc}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#16a34a',
                      backgroundColor: '#f0fdf4',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.swarm.airgapBadge}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Data Sources & Privacy Architecture */}
        {activeTab === 'governance' && (
          <div>
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '24px',
              }}
            >
              <div style={{ marginBottom: '20px' }}>
                <h2
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    margin: '0 0 4px 0',
                    color: '#0f172a',
                  }}
                >
                  {t.governance.title}
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  {t.governance.desc}
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '16px',
                  marginBottom: '24px',
                }}
              >
                {(
                  [
                    {
                      title: t.governance.tier1Title,
                      status: t.governance.tier1Status,
                      desc: t.governance.tier1Desc,
                      color: '#16a34a',
                      bg: '#f0fdf4',
                    },
                    {
                      title: t.governance.tier2Title,
                      status: t.governance.tier2Status,
                      desc: t.governance.tier2Desc,
                      color: '#2563eb',
                      bg: '#eff6ff',
                    },
                    {
                      title: t.governance.tier3Title,
                      status: t.governance.tier3Status,
                      desc: t.governance.tier3Desc,
                      color: '#475569',
                      bg: '#f1f5f9',
                    },
                    {
                      title: t.governance.tier4Title,
                      status: t.governance.tier4Status,
                      desc: t.governance.tier4Desc,
                      color: '#16a34a',
                      bg: '#f0fdf4',
                    },
                  ] as const
                ).map((tier) => (
                  <div
                    key={tier.title}
                    style={{
                      padding: '16px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
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
                          padding: '2px 8px',
                          borderRadius: '4px',
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
                        color: '#64748b',
                        lineHeight: '1.5',
                      }}
                    >
                      {tier.desc}
                    </p>
                  </div>
                ))}
              </div>

              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  marginBottom: '16px',
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
                    lineHeight: '1.7',
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
                  borderRadius: '6px',
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
                    color: '#64748b',
                    lineHeight: '1.5',
                  }}
                >
                  {t.governance.statementDesc}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer
        style={{
          borderTop: '1px solid #e2e8f0',
          padding: '24px 16px',
          backgroundColor: '#ffffff',
          marginTop: '40px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '12px',
            color: '#64748b',
          }}
        >
          <div>
            <span>© 2026 EntropyParadox Genomics. Open-source under MIT / Apache-2.0.</span>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a
              href="https://github.com/epgeno/plasmid"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#64748b', textDecoration: 'none' }}
            >
              GitHub
            </a>
            <a
              href="https://plasmid.wiki"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#64748b', textDecoration: 'none' }}
            >
              plasmid.wiki
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
