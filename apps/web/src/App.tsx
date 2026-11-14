import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import { SupportedLanguage, TRANSLATIONS } from './i18n'
import { GenomeNavigator } from './components/GenomeNavigator'
import {
  plasmidContainerClient,
  DEFAULT_OPFS_FILENAME,
  type ContainerSession,
} from './services/plasmidContainerClient'
import { decoderClient } from './services/decoderClient'
import { opfs } from './services/opfs'
import type {
  CatalogVariantItem,
  LiftoverResult,
  WasmMerkleVerification,
} from './types/plasmid'

function pickDifferentBase(base: string): string {
  const first = (base[0] || 'A').toUpperCase()
  return first === 'A' ? 'C' : 'A'
}

export default function App() {
  const [lang, setLang] = useState<SupportedLanguage>('ko')
  const [activeTab, setActiveTab] = useState<
    'navigator' | 'stream' | 'liftover' | 'wiki' | 'swarm' | 'governance'
  >('navigator')

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

  const t = TRANSLATIONS[lang]

  // Synchronize <html lang="..."> with active UI language
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
  }, [lang])

  // Load real .plasmid container header, index, metadata, and decoded VCF catalog on mount
  useEffect(() => {
    let cancelled = false

    const loadContainer = async () => {
      setCatalogLoading(true)
      setCatalogError(null)
      try {
        const hasLocalOpfs = await opfs.hasFile(DEFAULT_OPFS_FILENAME)
        const { session: loadedSession, items } =
          await plasmidContainerClient.loadCatalogVariants({
            airgapped: hasLocalOpfs,
          })

        if (cancelled) return
        setSession(loadedSession)
        setCatalogItems(items)
        if (items.length > 0) {
          setSelectedKey((prev) =>
            prev && items.some((it) => it.key === prev) ? prev : items[0].key
          )
        }
      } catch (err: unknown) {
        if (cancelled) return
        setCatalogError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    }

    void loadContainer()
    return () => {
      cancelled = true
    }
  }, [])

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
    const runWasmLiftover = async () => {
      try {
        const res = await decoderClient.liftoverCoordinate(
          'hg38_to_hg19',
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
      const altNeighbor = pickDifferentBase(refAllele).repeat(refAllele.length)
      const refWindow = `${refAllele}${altNeighbor}`
      const testPos = simulateAdversarialDrift
        ? current.variant.pos + 1
        : current.variant.pos

      try {
        await decoderClient.verifyRefFingerprint(
          current.variant.id,
          current.variant.chrom,
          testPos,
          refAllele,
          refWindow,
          current.variant.pos,
          'GRCh38'
        )
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
  }, [current, simulateAdversarialDrift])

  const handleVerifyMerkle = async () => {
    setVerifying(true)
    setVerifyError(null)
    try {
      const hasLocalOpfs = await opfs.hasFile(DEFAULT_OPFS_FILENAME)
      const { verification, elapsedMs, session: verifiedSession } =
        await plasmidContainerClient.verifyContainerMerkle({
          airgapped: hasLocalOpfs,
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
              {t.locus.activeLocus}
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
              catalogItems={catalogItems}
              selectedCatalogKey={selectedKey}
              onSelectCatalogKey={setSelectedKey}
            />
          </div>
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
                {guardError || liftoverError ? (
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
                          {guardError || liftoverError}
                        </code>
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
                      {t.liftover.sourceBuild}
                    </span>
                    <span
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        fontFamily: 'ui-monospace, monospace',
                        wordBreak: 'break-all',
                        color: guardError || liftoverError ? '#dc2626' : '#0f172a',
                      }}
                    >
                      {guardError || liftoverError
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
                      {t.liftover.targetBuild}
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
                        color: guardError || liftoverError ? '#dc2626' : '#16a34a',
                        fontWeight: 600,
                        display: 'block',
                        marginTop: '4px',
                      }}
                    >
                      {guardError || liftoverError
                        ? t.liftover.blockedNote
                        : t.liftover.deltaNote}
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
