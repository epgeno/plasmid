import { useState } from 'react'
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
  Star,
  Lock,
  Compass,
} from 'lucide-react'
import {
  SupportedLanguage,
  TRANSLATIONS,
  LOCALIZED_PRESET_VARIANTS,
  LocalizedVariant,
} from './i18n'
import { GenomeNavigator } from './components/GenomeNavigator'

export default function App() {
  const [lang, setLang] = useState<SupportedLanguage>('ko')
  const [activeTab, setActiveTab] = useState<'navigator' | 'stream' | 'liftover' | 'wiki' | 'swarm' | 'governance'>('navigator')
  const [selectedVariant, setSelectedVariant] = useState<string>('braf_v600e')
  const [simulateAdversarialDrift, setSimulateAdversarialDrift] = useState<boolean>(false)
  const [verifying, setVerifying] = useState<boolean>(false)
  const [verifiedChunks, setVerifiedChunks] = useState<Record<number, boolean>>({
    64: true,
    65: true,
    128: true,
    129: true,
    192: true,
    193: true,
  })

  const t = TRANSLATIONS[lang]
  const current: LocalizedVariant =
    LOCALIZED_PRESET_VARIANTS.find((v) => v.id === selectedVariant) ?? LOCALIZED_PRESET_VARIANTS[0]

  const handleVerify = () => {
    setVerifying(true)
    setTimeout(() => {
      setVerifying(false)
      setVerifiedChunks((prev) => ({
        ...prev,
        [current.chunks[0]]: true,
        [current.chunks[1]]: true,
      }))
    }, 600)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', color: '#0f172a', fontFamily: 'Pretendard, system-ui, sans-serif' }}>
      {/* Top Professional Notice Banner */}
      <div style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '8px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{t.disclaimer.bannerTitle}:</span>
            <span>{t.disclaimer.bannerDesc}</span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
            {t.disclaimer.badgeLocal}
          </span>
        </div>
      </div>

      {/* Global Header */}
      <header style={{ borderBottom: '1px solid #e2e8f0', padding: '16px 24px', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '34px', height: '34px', backgroundColor: '#2563eb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
                  {t.header.title}
                </span>
                <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: '4px', fontWeight: 700 }}>
                  v0.1.0
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                {t.header.subtitle}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Language Selector */}
            <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
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
                    transition: 'all 0.15s ease',
                  }}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Navigation Tabs */}
            <nav style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
              <button
                onClick={() => setActiveTab('navigator')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: activeTab === 'navigator' ? 700 : 500,
                  backgroundColor: activeTab === 'navigator' ? '#ffffff' : 'transparent',
                  color: activeTab === 'navigator' ? '#0f172a' : '#64748b',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: activeTab === 'navigator' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <Compass size={15} />
                {t.header.tabs.navigator}
              </button>
              <button
                onClick={() => setActiveTab('stream')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: activeTab === 'stream' ? 700 : 500,
                  backgroundColor: activeTab === 'stream' ? '#ffffff' : 'transparent',
                  color: activeTab === 'stream' ? '#0f172a' : '#64748b',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: activeTab === 'stream' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <Layers size={15} />
                {t.header.tabs.viewer}
              </button>
              <button
                onClick={() => setActiveTab('liftover')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: activeTab === 'liftover' ? 700 : 500,
                  backgroundColor: activeTab === 'liftover' ? '#ffffff' : 'transparent',
                  color: activeTab === 'liftover' ? '#0f172a' : '#64748b',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: activeTab === 'liftover' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <ArrowRightLeft size={15} />
                {t.header.tabs.liftover}
              </button>
              <button
                onClick={() => setActiveTab('wiki')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: activeTab === 'wiki' ? 700 : 500,
                  backgroundColor: activeTab === 'wiki' ? '#ffffff' : 'transparent',
                  color: activeTab === 'wiki' ? '#0f172a' : '#64748b',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: activeTab === 'wiki' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <FileText size={15} />
                {t.header.tabs.wiki}
              </button>
              <button
                onClick={() => setActiveTab('swarm')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: activeTab === 'swarm' ? 700 : 500,
                  backgroundColor: activeTab === 'swarm' ? '#ffffff' : 'transparent',
                  color: activeTab === 'swarm' ? '#0f172a' : '#64748b',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: activeTab === 'swarm' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <Radio size={15} />
                {t.header.tabs.network}
              </button>
              <button
                onClick={() => setActiveTab('governance')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: activeTab === 'governance' ? 700 : 500,
                  backgroundColor: activeTab === 'governance' ? '#ffffff' : 'transparent',
                  color: activeTab === 'governance' ? '#0f172a' : '#64748b',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: activeTab === 'governance' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <Scale size={15} />
                {t.header.tabs.sources}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {/* Active Variant Selection Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              {t.locus.activeLocus}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{current.label}</span>
              <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                {current.chrom}:{current.pos} ({current.ref} &gt; {current.alt})
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              {t.locus.targetBuild}
            </span>
            <select
              value={selectedVariant}
              onChange={(e) => setSelectedVariant(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                backgroundColor: '#ffffff',
                fontWeight: 600,
                color: '#0f172a',
                cursor: 'pointer',
              }}
            >
              {LOCALIZED_PRESET_VARIANTS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.gene} - {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TAB 0: Multi-scale Whole-Genome Navigator */}
        {activeTab === 'navigator' && (
          <div style={{ marginBottom: '24px' }}>
            <GenomeNavigator />
          </div>
        )}

        {/* TAB 1: Data Viewer (Range Slicing) */}
        {activeTab === 'stream' && (
          <div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>
                    {t.stream.title}
                  </h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    {t.stream.desc}
                  </p>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 8px', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: '4px' }}>
                  {t.stream.savingsLabel}
                </span>
              </div>

              {/* Variant Badge & Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{current.gene}</span>
                    <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '4px', fontWeight: 700 }}>
                      {current.significance}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    {current.clinvarId} • {current.rsId}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Star
                        key={i}
                        size={15}
                        fill={i < current.stars ? '#eab308' : 'none'}
                        color={i < current.stars ? '#eab308' : '#cbd5e1'}
                      />
                    ))}
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#ca8a04', marginLeft: '4px' }}>
                      {current.stars} / 4 {t.stream.stars}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{current.reviewStatus[lang]}</span>
                </div>
              </div>

              {/* Data Range Specifications */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{t.stream.dataRange}</span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{current.byteRange}</span>
                </div>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{t.stream.indexOffset}</span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                    offset={current.leafOffset} len={current.leafLength}B
                  </span>
                </div>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{t.stream.dataBlocks}</span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                    #{current.chunks.join(', #')}
                  </span>
                </div>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{t.stream.license}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a' }}>{current.license}</span>
                </div>
              </div>

              {/* Integrity Verification Card */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{t.stream.integrityTitle}</span>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{current.merkleRoot}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <CheckCircle2 size={14} color="#16a34a" />
                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                        {verifiedChunks[current.chunks[0]] ? t.stream.verified : t.stream.pending}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleVerify}
                    disabled={verifying}
                    style={{
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      cursor: verifying ? 'default' : 'pointer',
                      color: '#0f172a',
                    }}
                  >
                    {verifying ? t.stream.verifyingBtn : t.stream.verifyBtn}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Assembly Liftover */}
        {activeTab === 'liftover' && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>
                  {t.liftover.title}
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  {t.liftover.desc}
                </p>
              </div>

              {/* Safe simulation toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={simulateAdversarialDrift}
                  onChange={(e) => setSimulateAdversarialDrift(e.target.checked)}
                />
                <span style={{ fontWeight: 600, color: simulateAdversarialDrift ? '#dc2626' : '#64748b' }}>
                  {t.liftover.testToggle}
                </span>
              </label>
            </div>

            {/* Status Alert */}
            {simulateAdversarialDrift ? (
              <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <ShieldAlert size={18} color="#dc2626" style={{ marginTop: '2px' }} />
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#991b1b' }}>
                      {t.liftover.warningTitle}
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>
                      {t.liftover.warningDesc}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <ShieldCheck size={18} color="#16a34a" style={{ marginTop: '2px' }} />
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#166534' }}>
                      {t.liftover.verifiedTitle}
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#15803d' }}>
                      {t.liftover.verifiedDesc}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Coordinate Comparison Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '20px', alignItems: 'center' }}>
              <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  {t.liftover.sourceBuild}
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'monospace' }}>
                  {current.chrom}:{simulateAdversarialDrift ? current.hg19Pos + 1 : current.hg19Pos}
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                  Alleles: {current.ref} &gt; {current.alt}
                </span>
              </div>

              <div style={{ textAlign: 'center' }}>
                <ArrowRightLeft size={20} color="#64748b" />
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                  {t.liftover.delta}: {Math.abs(current.pos - current.hg19Pos).toLocaleString()} bp
                </span>
              </div>

              <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  {t.liftover.targetBuild}
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'monospace' }}>
                  {current.chrom}:{current.pos}
                </span>
                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                  {t.liftover.deltaNote}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Clinical Notes & Knowledge Wiki */}
        {activeTab === 'wiki' && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  {current.label}
                </h2>
                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                  {t.wiki.reference}: {current.clinvarId}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontWeight: 600 }}>
                  {current.significance}
                </span>
                <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '4px', fontWeight: 600 }}>
                  dbSNP: {current.rsId}
                </span>
                <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '4px', fontWeight: 600 }}>
                  MIM: {current.omimId}
                </span>
              </div>
            </div>

            {/* Note Text */}
            <div style={{ lineHeight: '1.6', fontSize: '14px', color: '#334155', marginBottom: '24px' }}>
              <p>{current.notes[lang]}</p>
            </div>

            {/* ACMG Tags */}
            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                {t.wiki.acmgCriteria}
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {current.acmgTags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '11px',
                      padding: '4px 8px',
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

            {/* Scientific Citations */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                  {t.wiki.citationsTitle}
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{t.wiki.citationsNote}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {current.pmids.map((pmid) => (
                  <a
                    key={pmid}
                    href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: '#2563eb',
                      textDecoration: 'none',
                      padding: '6px 10px',
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
          </div>
        )}

        {/* TAB 4: P2P Network */}
        {activeTab === 'swarm' && (
          <div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>
                    {t.swarm.title}
                  </h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    {t.swarm.desc}
                  </p>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 8px', backgroundColor: '#f0fdf4', color: '#16a34a', borderRadius: '4px' }}>
                  {t.swarm.peerStats}
                </span>
              </div>

              {/* Active Clinical Panels */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '14px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block' }}>
                    {t.swarm.packClinvar}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    52.4 MB • 14,820 variants
                  </span>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, display: 'block', marginTop: '6px' }}>
                    ● 8 peers seeding
                  </span>
                </div>

                <div style={{ padding: '14px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block' }}>
                    {t.swarm.packAcmg}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    38.1 MB • 8,450 variants
                  </span>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, display: 'block', marginTop: '6px' }}>
                    ● 6 peers seeding
                  </span>
                </div>

                <div style={{ padding: '14px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block' }}>
                    {t.swarm.packCpic}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    24.6 MB • 3,210 variants
                  </span>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, display: 'block', marginTop: '6px' }}>
                    ● 5 peers seeding
                  </span>
                </div>
              </div>

              {/* Privacy Protection Card */}
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={16} color="#2563eb" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      {t.swarm.privacyTitle}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                    {t.swarm.privacyBadge}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  {t.swarm.privacyDesc}
                </p>
                <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>
                    ✓ {t.swarm.privacyStatusTitle}
                  </span>
                  <span style={{ fontSize: '11px', color: '#475569', display: 'block', marginTop: '2px' }}>
                    {t.swarm.privacyStatusDesc}
                  </span>
                </div>
              </div>

              {/* Integrity Protection Card */}
              <div style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      {t.swarm.integrityTitle}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                      {t.swarm.integrityDesc}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a', backgroundColor: '#f0fdf4', padding: '4px 8px', borderRadius: '4px' }}>
                    {t.swarm.airgapBadge}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Nodes List */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '12px' }}>
                {t.swarm.activePeersTitle}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '12px' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>node_us_east_8f2a</span>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>● {t.swarm.peerStateSharing} (52.4 MB)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '12px' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>node_ap_ne2_41d9</span>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>● {t.swarm.peerStateSharing} (38.1 MB)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '12px' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>node_eu_west_c3e1</span>
                  <span style={{ color: '#2563eb', fontWeight: 600 }}>◐ {t.swarm.peerStateVerifying}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Data Sources & Privacy Architecture */}
        {activeTab === 'governance' && (
          <div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', marginBottom: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>
                  {t.governance.title}
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  {t.governance.desc}
                </p>
              </div>

              {/* 4-Tier Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      {t.governance.tier1Title}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', backgroundColor: '#f0fdf4', padding: '2px 6px', borderRadius: '4px' }}>
                      {t.governance.tier1Status}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                    {t.governance.tier1Desc}
                  </p>
                </div>

                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      {t.governance.tier2Title}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                      {t.governance.tier2Status}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                    {t.governance.tier2Desc}
                  </p>
                </div>

                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      {t.governance.tier3Title}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                      {t.governance.tier3Status}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                    {t.governance.tier3Desc}
                  </p>
                </div>

                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      {t.governance.tier4Title}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', backgroundColor: '#f0fdf4', padding: '2px 6px', borderRadius: '4px' }}>
                      {t.governance.tier4Status}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                    {t.governance.tier4Desc}
                  </p>
                </div>
              </div>

              {/* Official Attributions */}
              <div style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                  {t.governance.attributionsTitle}
                </span>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#475569', lineHeight: '1.7' }}>
                  <li>{t.governance.gnomadAttr}</li>
                  <li>{t.governance.cpicAttr}</li>
                </ul>
              </div>

              {/* Statement */}
              <div style={{ padding: '14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  {t.governance.statementTitle}
                </span>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                  {t.governance.statementDesc}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Global Footer */}
      <footer style={{ borderTop: '1px solid #e2e8f0', padding: '24px', backgroundColor: '#ffffff', marginTop: '40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
          <div>
            <span>© 2026 EntropyParadox Genomics. Open-source under MIT / Apache-2.0.</span>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a href="https://github.com/epgeno/plasmid" target="_blank" rel="noopener noreferrer" style={{ color: '#64748b', textDecoration: 'none' }}>
              GitHub
            </a>
            <a href="https://plasmid.wiki" target="_blank" rel="noopener noreferrer" style={{ color: '#64748b', textDecoration: 'none' }}>
              plasmid.wiki
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
