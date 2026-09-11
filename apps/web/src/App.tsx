import { useState } from 'react'
import {
  Cpu,
  Layers,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  ArrowRightLeft,
  FileText,
  Activity,
  ExternalLink,
  Radio,
  Scale,
  Ban,
  Star,
  Globe,
} from 'lucide-react'
import {
  SupportedLanguage,
  TRANSLATIONS,
  LOCALIZED_PRESET_VARIANTS,
} from './i18n'

export default function App() {
  const [lang, setLang] = useState<SupportedLanguage>('ko')
  const [activeTab, setActiveTab] = useState<'stream' | 'liftover' | 'wiki' | 'swarm' | 'governance'>('stream')
  const [selectedKey, setSelectedKey] = useState<string>('BRAF V600E')
  const [simulateAdversarialDrift, setSimulateAdversarialDrift] = useState<boolean>(false)
  const [kAnonymityMode, setKAnonymityMode] = useState<'single' | 'panel'>('panel')
  const [isVerifying, setIsVerifying] = useState<boolean>(false)
  const [verifiedChunks, setVerifiedChunks] = useState<Record<number, boolean>>({
    64: true,
    128: true,
    192: true,
  })

  const t = TRANSLATIONS[lang]
  const current = LOCALIZED_PRESET_VARIANTS[selectedKey] || LOCALIZED_PRESET_VARIANTS['BRAF V600E']

  const handleVerifyMerkle = () => {
    setIsVerifying(true)
    setTimeout(() => {
      setIsVerifying(false)
      setVerifiedChunks((prev) => {
        const next = { ...prev }
        current.chunks.forEach((c) => {
          next[c] = true
        })
        return next
      })
    }, 450)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', color: '#0f172a', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Top Disclaimer Banner */}
      <div
        style={{
          backgroundColor: '#fef2f2',
          borderBottom: '1px solid #fecaca',
          padding: '8px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#991b1b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={15} color="#dc2626" />
          <span>
            <strong>{t.disclaimer.bannerTitle}</strong> {t.disclaimer.bannerDesc}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#b91c1c' }}>
          <span>{t.disclaimer.badgeLocal}</span>
        </div>
      </div>

      {/* Global Header */}
      <header
        style={{
          borderBottom: '1px solid #e2e8f0',
          padding: '14px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/plasmid.svg" alt="Plasmid Logo" style={{ width: '28px', height: '28px' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                Plasmid
              </h1>
              <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                v0.1.0-alpha
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              {t.header.subtitle}
            </p>
          </div>
        </div>

        {/* Global Navigation Tabs & Language Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setActiveTab('stream')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTab === 'stream' ? '#0284c7' : '#e2e8f0',
                backgroundColor: activeTab === 'stream' ? '#f0f9ff' : '#ffffff',
                color: activeTab === 'stream' ? '#0284c7' : '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Layers size={14} /> {t.header.tabs.stream}
            </button>
            <button
              onClick={() => setActiveTab('liftover')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTab === 'liftover' ? '#0284c7' : '#e2e8f0',
                backgroundColor: activeTab === 'liftover' ? '#f0f9ff' : '#ffffff',
                color: activeTab === 'liftover' ? '#0284c7' : '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ArrowRightLeft size={14} /> {t.header.tabs.liftover}
            </button>
            <button
              onClick={() => setActiveTab('wiki')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTab === 'wiki' ? '#0284c7' : '#e2e8f0',
                backgroundColor: activeTab === 'wiki' ? '#f0f9ff' : '#ffffff',
                color: activeTab === 'wiki' ? '#0284c7' : '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <FileText size={14} /> {t.header.tabs.wiki}
            </button>
            <button
              onClick={() => setActiveTab('swarm')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTab === 'swarm' ? '#0284c7' : '#e2e8f0',
                backgroundColor: activeTab === 'swarm' ? '#f0f9ff' : '#ffffff',
                color: activeTab === 'swarm' ? '#0284c7' : '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Radio size={14} /> {t.header.tabs.swarm}
            </button>
            <button
              onClick={() => setActiveTab('governance')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeTab === 'governance' ? '#0284c7' : '#e2e8f0',
                backgroundColor: activeTab === 'governance' ? '#f0f9ff' : '#ffffff',
                color: activeTab === 'governance' ? '#0284c7' : '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Scale size={14} /> {t.header.tabs.governance}
            </button>
          </div>

          {/* Language Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px', backgroundColor: '#f8fafc' }}>
            <Globe size={13} style={{ marginLeft: '4px', color: '#64748b' }} />
            {(['ko', 'en', 'zh', 'ja'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: lang === l ? '#0f172a' : 'transparent',
                  color: lang === l ? '#ffffff' : '#64748b',
                  fontSize: '11px',
                  fontWeight: lang === l ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {/* Locus Selection Bar */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
              {t.locus.activeLocus}
            </span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              {Object.keys(LOCALIZED_PRESET_VARIANTS).map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: selectedKey === key ? '#0f172a' : '#cbd5e1',
                    backgroundColor: selectedKey === key ? '#0f172a' : '#ffffff',
                    color: selectedKey === key ? '#ffffff' : '#334155',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
              {t.locus.targetBuild}
            </span>
          </div>
        </div>

        {/* Tab 1: Data Viewer (Range Slicing) */}
        {activeTab === 'stream' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Bandwidth Savings Card */}
            <div
              style={{
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#eff6ff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={20} color="#0284c7" />
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0369a1' }}>
                    {t.stream.cardTitle}
                  </h3>
                </div>
                <p style={{ fontSize: '13px', color: '#0369a1', margin: '4px 0 0 0' }}>
                  {t.stream.cardDesc}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#0369a1', fontWeight: 700, display: 'block' }}>
                  {t.stream.metricLabel}
                </span>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#0284c7' }}>
                  95.0%
                </span>
              </div>
            </div>

            {/* Slicing Inspection Panel */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
                    {current.gene} ({current.mutation})
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    {current.chrom}:{current.hg38Pos} • rs{current.rsid} • {current.ref}&gt;{current.alt}
                  </p>
                </div>
                {/* ClinVar Star Rating Badge */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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

              {/* Range Specs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{t.stream.httpRange}</span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{current.byteRange}</span>
                </div>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{t.stream.leafIndex}</span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                    offset={current.leafOffset} len={current.leafLength}B
                  </span>
                </div>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{t.stream.targetChunks}</span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                    #{current.chunks.join(', #')} (16KB)
                  </span>
                </div>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{t.stream.license}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a' }}>{current.license}</span>
                </div>
              </div>

              {/* Merkle Verification Card */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{t.stream.merkleTitle}</span>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{current.merkleRoot}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <CheckCircle2 size={14} color="#16a34a" />
                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                        {verifiedChunks[current.chunks[0]] ? t.stream.merkleVerified : t.stream.merklePending}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleVerifyMerkle}
                    disabled={isVerifying}
                    style={{
                      padding: '6px 14px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isVerifying ? t.stream.verifyingBtn : t.stream.reverifyBtn}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Assembly Liftover */}
        {activeTab === 'liftover' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                    {t.liftover.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    {t.liftover.desc}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={simulateAdversarialDrift}
                      onChange={(e) => setSimulateAdversarialDrift(e.target.checked)}
                    />
                    <span style={{ fontWeight: 600, color: simulateAdversarialDrift ? '#dc2626' : '#475569' }}>
                      {t.liftover.simulateDrift}
                    </span>
                  </label>
                </div>
              </div>

              {/* Status Report */}
              {simulateAdversarialDrift ? (
                <div
                  style={{
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    padding: '16px',
                    backgroundColor: '#fef2f2',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '20px',
                  }}
                >
                  <ShieldAlert size={24} color="#dc2626" />
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#991b1b', margin: 0 }}>
                      {t.liftover.driftDetectedTitle}
                    </h4>
                    <p style={{ fontSize: '12px', color: '#b91c1c', margin: '2px 0 0 0' }}>
                      {t.liftover.driftDetectedDesc}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px',
                    padding: '16px',
                    backgroundColor: '#f0fdf4',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '20px',
                  }}
                >
                  <ShieldCheck size={24} color="#16a34a" />
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#166534', margin: 0 }}>
                      {t.liftover.verifiedTitle}
                    </h4>
                    <p style={{ fontSize: '12px', color: '#15803d', margin: '2px 0 0 0' }}>
                      {t.liftover.verifiedDesc} (hg19:{current.hg19Pos} ➔ hg38:{current.hg38Pos})
                    </p>
                  </div>
                </div>
              )}

              {/* Liftover Transformation Table */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{t.liftover.sourceBuild}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>
                    GRCh37 / hg19
                  </span>
                  <span style={{ fontSize: '12px', display: 'block', marginTop: '4px', color: '#475569' }}>
                    {current.chrom}:{simulateAdversarialDrift ? current.hg19Pos + 1 : current.hg19Pos}
                  </span>
                </div>
                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{t.liftover.delta}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: '#0284c7' }}>
                    +{current.hg38Pos - current.hg19Pos} bp
                  </span>
                  <span style={{ fontSize: '12px', display: 'block', marginTop: '4px', color: '#64748b' }}>
                    {t.liftover.deltaNote}
                  </span>
                </div>
                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{t.liftover.targetBuild}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: '#16a34a' }}>
                    GRCh38 / hg38
                  </span>
                  <span style={{ fontSize: '12px', display: 'block', marginTop: '4px', color: '#475569' }}>
                    {current.chrom}:{current.hg38Pos}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Clinical Notes */}
        {activeTab === 'wiki' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>
                    {current.gene} {current.mutation}
                  </h2>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
                    {t.wiki.reference}: rs{current.rsid} • {t.wiki.clinicalSignificance}:{' '}
                    <span style={{ fontWeight: 700, color: '#dc2626' }}>{current.clinvar}</span>
                  </p>
                </div>
                {/* ClinVar Star Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#fef9c3', padding: '6px 12px', borderRadius: '6px', border: '1px solid #fef08a' }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      fill={i < current.stars ? '#ca8a04' : 'none'}
                      color={i < current.stars ? '#ca8a04' : '#cbd5e1'}
                    />
                  ))}
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#854d0e', marginLeft: '6px' }}>
                    {current.stars} / 4 {t.stream.stars} ({current.reviewStatus[lang]})
                  </span>
                </div>
              </div>

              {/* ACMG Criteria Tags */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {current.acmg.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'monospace',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Clinical Description */}
              <div style={{ marginBottom: '24px', lineHeight: 1.7, fontSize: '14px', color: '#334155' }}>
                <p>{current.notes[lang]}</p>
              </div>

              {/* Literature Citations */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                    {t.wiki.citationsTitle}
                  </h4>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {t.wiki.citationsNote}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {current.pubmed.map((p) => (
                    <a
                      key={p.id}
                      href={`https://pubmed.ncbi.nlm.nih.gov/${p.id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '10px 14px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        textDecoration: 'none',
                        color: 'inherit',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>
                        {p.title} ({p.year})
                      </span>
                      <span style={{ fontSize: '12px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        PMID:{p.id} <ExternalLink size={13} />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: P2P Network */}
        {activeTab === 'swarm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{t.swarm.title}</h3>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    {t.swarm.desc}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="#16a34a" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#16a34a' }}>{t.swarm.activeTopics}</span>
                </div>
              </div>

              {/* Hotspot Annotation Packs List */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', marginBottom: '4px' }}>
                    {t.swarm.packClinvar}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>~50 MB</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    12 {t.swarm.peerStats}
                  </div>
                </div>

                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', marginBottom: '4px' }}>
                    {t.swarm.packAcmg}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>~15 MB</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    34 {t.swarm.peerStats}
                  </div>
                </div>

                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', marginBottom: '4px' }}>
                    {t.swarm.packCpic}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>~5 MB</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    18 {t.swarm.peerStats}
                  </div>
                </div>
              </div>

              {/* Privacy Protection Card */}
              <div style={{ padding: '20px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      {t.swarm.privacyTitle}
                    </h4>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                      {t.swarm.privacyDesc}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setKAnonymityMode('single')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: kAnonymityMode === 'single' ? '#dc2626' : '#cbd5e1',
                        backgroundColor: kAnonymityMode === 'single' ? '#fef2f2' : '#ffffff',
                        color: kAnonymityMode === 'single' ? '#dc2626' : '#475569',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {t.swarm.btnSingle}
                    </button>
                    <button
                      onClick={() => setKAnonymityMode('panel')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: kAnonymityMode === 'panel' ? '#16a34a' : '#cbd5e1',
                        backgroundColor: kAnonymityMode === 'panel' ? '#f0fdf4' : '#ffffff',
                        color: kAnonymityMode === 'panel' ? '#16a34a' : '#475569',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {t.swarm.btnCoarse}
                    </button>
                  </div>
                </div>

                {kAnonymityMode === 'single' ? (
                  <div style={{ padding: '12px 16px', borderRadius: '4px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Ban size={18} color="#dc2626" />
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', display: 'block' }}>
                        {t.swarm.privacyBlockedTitle}
                      </span>
                      <span style={{ fontSize: '12px', color: '#b91c1c' }}>
                        {t.swarm.privacyBlockedDesc}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '12px 16px', borderRadius: '4px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldCheck size={18} color="#16a34a" />
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534', display: 'block' }}>
                        {t.swarm.privacyActiveTitle}
                      </span>
                      <span style={{ fontSize: '12px', color: '#15803d' }}>
                        {t.swarm.privacyActiveDesc}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Data Integrity Status */}
              <div style={{ padding: '16px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} color="#16a34a" />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                        {t.swarm.byzantineTitle}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {t.swarm.byzantineDesc}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a', backgroundColor: '#dcfce7', padding: '4px 8px', borderRadius: '4px' }}>
                    {t.swarm.airgapBadge}
                  </span>
                </div>
              </div>

              {/* Peers List */}
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                {t.swarm.activePeersTitle}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { id: 'peer-tokyo-01', rtt: '14ms', up: '2.4 MB/s', state: t.swarm.peerStateSeeding },
                  { id: 'peer-seoul-09', rtt: '22ms', up: '3.1 MB/s', state: t.swarm.peerStateSeeding },
                  { id: 'peer-frankfurt-03', rtt: '48ms', up: '1.2 MB/s', state: t.swarm.peerStateVerifying },
                ].map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>{p.id}</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>RTT: {p.rtt}</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Rate: {p.up}</span>
                    <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 500 }}>{p.state}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Data Sources & Privacy Architecture */}
        {activeTab === 'governance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
                {t.governance.title}
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>
                {t.governance.desc}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', border: '1px solid #bbf7d0', borderRadius: '6px', backgroundColor: '#f0fdf4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>
                      {t.governance.tier1Title}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
                      {t.governance.tier1Status}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#15803d', margin: 0, lineHeight: 1.5 }}>
                    {t.governance.tier1Desc}
                  </p>
                </div>

                <div style={{ padding: '16px', border: '1px solid #bfdbfe', borderRadius: '6px', backgroundColor: '#eff6ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af' }}>
                      {t.governance.tier2Title}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#2563eb', backgroundColor: '#dbeafe', padding: '2px 6px', borderRadius: '4px' }}>
                      {t.governance.tier2Status}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#1d4ed8', margin: 0, lineHeight: 1.5 }}>
                    {t.governance.tier2Desc}
                  </p>
                </div>

                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
                      {t.governance.tier3Title}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                      {t.governance.tier3Status}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                    {t.governance.tier3Desc}
                  </p>
                </div>

                <div style={{ padding: '16px', border: '1px solid #fed7aa', borderRadius: '6px', backgroundColor: '#fff7ed' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#9a3412' }}>
                      {t.governance.tier4Title}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#ea580c', backgroundColor: '#ffedd5', padding: '2px 6px', borderRadius: '4px' }}>
                      {t.governance.tier4Status}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#c2410c', margin: 0, lineHeight: 1.5 }}>
                    {t.governance.tier4Desc}
                  </p>
                </div>
              </div>

              {/* Official Attributions & Research Statement */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '10px' }}>
                  {t.governance.attributionsTitle}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
                  <div>{t.governance.gnomadAttr}</div>
                  <div>{t.governance.cpicAttr}</div>
                  <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '11px' }}>
                    {t.governance.regulatoryNotice}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
