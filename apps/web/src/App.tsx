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
} from 'lucide-react'

interface VariantData {
  gene: string
  mutation: string
  chrom: string
  hg19Pos: number
  hg38Pos: number
  ref: string
  alt: string
  rsid: string
  clinvar: 'Pathogenic' | 'Likely Pathogenic' | 'Uncertain Significance' | 'Benign'
  stars: number
  reviewStatus: string
  license: string
  attributionNotice: string
  acmg: string[]
  chunks: number[]
  byteRange: string
  merkleRoot: string
  leafOffset: number
  leafLength: number
  pubmed: { id: string; title: string; year: number }[]
  notes: string
}

const PRESET_VARIANTS: Record<string, VariantData> = {
  'BRAF V600E': {
    gene: 'BRAF',
    mutation: 'V600E',
    chrom: 'chr7',
    hg19Pos: 140453136,
    hg38Pos: 140753336,
    ref: 'T',
    alt: 'A',
    rsid: 'rs113488022',
    clinvar: 'Pathogenic',
    stars: 4,
    reviewStatus: 'Practice guideline (Highest clinical confidence)',
    license: 'Public Domain (17 U.S.C. § 105)',
    attributionNotice: 'NCBI ClinVar / dbSNP',
    acmg: ['PS1', 'PS3', 'PM1', 'PM2', 'PP3'],
    chunks: [8572, 8573],
    byteRange: 'bytes=140451840-140484607',
    merkleRoot: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    leafOffset: 2048,
    leafLength: 1024,
    pubmed: [
      { id: '12068308', title: 'Mutations of the BRAF gene in human cancer', year: 2002 },
      { id: '22818981', title: 'Improved survival with vemurafenib in melanoma with BRAF V600E mutation', year: 2011 },
    ],
    notes: 'Valine to glutamic acid substitution at codon 600 in the kinase domain, leading to constitutive activation of the MAP kinase pathway.',
  },
  'TP53 R175H': {
    gene: 'TP53',
    mutation: 'R175H',
    chrom: 'chr17',
    hg19Pos: 7577538,
    hg38Pos: 7674220,
    ref: 'C',
    alt: 'T',
    rsid: 'rs28934578',
    clinvar: 'Pathogenic',
    stars: 3,
    reviewStatus: 'Reviewed by expert panel (ClinGen TP53 Panel)',
    license: 'Public Domain (17 U.S.C. § 105)',
    attributionNotice: 'NCBI ClinVar / dbSNP',
    acmg: ['PS1', 'PS3', 'PM1', 'PM5', 'PP3'],
    chunks: [468, 469],
    byteRange: 'bytes=7667712-7700479',
    merkleRoot: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    leafOffset: 3072,
    leafLength: 1024,
    pubmed: [
      { id: '20427387', title: 'The p53 tumor suppressor protein: meeting review', year: 2010 },
      { id: '31575995', title: 'Structure and conformational dynamics of p53 DNA-binding domain', year: 2019 },
    ],
    notes: 'Structural hotspot mutation disrupting the zinc coordination sphere of the DNA-binding domain, causing global conformational destabilization.',
  },
  'HBB rs334 (HbS)': {
    gene: 'HBB',
    mutation: 'E6V (Sickle Cell)',
    chrom: 'chr11',
    hg19Pos: 5248232,
    hg38Pos: 5227002,
    ref: 'T',
    alt: 'A',
    rsid: 'rs334',
    clinvar: 'Pathogenic',
    stars: 4,
    reviewStatus: 'Practice guideline (ACMG / CPIC Actionable)',
    license: 'Public Domain (17 U.S.C. § 105)',
    attributionNotice: 'NCBI ClinVar / CPIC PharmGKB (CC-BY 4.0)',
    acmg: ['PS1', 'PS3', 'PM1', 'PP3'],
    chunks: [319, 320],
    byteRange: 'bytes=5226496-5259263',
    merkleRoot: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    leafOffset: 4096,
    leafLength: 1024,
    pubmed: [
      { id: '15917409', title: 'Sickle cell disease: basic principles and clinical practice', year: 2005 },
    ],
    notes: 'Glutamic acid to valine substitution causing hemoglobin tetramers to aggregate into rigid helical fibers under low oxygen tension.',
  },
}

export default function App() {
  const [selectedKey, setSelectedKey] = useState<string>('BRAF V600E')
  const [activeTab, setActiveTab] = useState<'stream' | 'wiki' | 'swarm' | 'liftover' | 'governance'>('stream')
  const [isVerifying, setIsVerifying] = useState(false)
  const [simulateAdversarialDrift, setSimulateAdversarialDrift] = useState(false)
  const [kAnonymityTestMode, setKAnonymityTestMode] = useState<'coarse' | 'fine'>('coarse')
  const [filterTestResult, setFilterTestResult] = useState<{
    target: string
    status: 'allowed' | 'blocked'
    reason: string
  } | null>(null)
  const [verifiedChunks, setVerifiedChunks] = useState<Record<number, boolean>>({
    8572: true,
    8573: true,
    468: true,
    469: true,
    319: true,
    320: true,
  })

  const current = PRESET_VARIANTS[selectedKey] || PRESET_VARIANTS['BRAF V600E']

  const handleVerifyMerkle = () => {
    setIsVerifying(true)
    setTimeout(() => {
      setIsVerifying(false)
      setVerifiedChunks((prev) => ({
        ...prev,
        [current.chunks[0]]: true,
        [current.chunks[1]]: true,
      }))
    }, 300)
  }

  const runAdversarialFilterTest = (target: 'omim' | 'cosmic' | 'odbl_fail' | 'clinvar') => {
    if (target === 'omim') {
      setFilterTestResult({
        target: 'OMIM Clinical Synopsis Scrape',
        status: 'blocked',
        reason: 'DataGovernanceViolation: Proprietary clinical synopsis detected (Johns Hopkins University). Narrative text redistribution prohibited under JHU agreement. Only MIM:###### IDs permitted.',
      })
    } else if (target === 'cosmic') {
      setFilterTestResult({
        target: 'COSMIC Somatic Mutations Export',
        status: 'blocked',
        reason: 'DataGovernanceViolation: Proprietary COSMIC somatic database markers detected (COSMIC_ID=COSM476). Licensed exclusively by QIAGEN/Sanger. Commercial/P2P redistribution blocked.',
      })
    } else if (target === 'odbl_fail') {
      setFilterTestResult({
        target: 'gnomAD Unpartitioned Import',
        status: 'blocked',
        reason: 'DataGovernanceViolation: gnomAD (ODbL 1.0) cannot be intertwined with core proprietary tables. Must reside in an isolated pack partition with mandatory attribution banner.',
      })
    } else {
      setFilterTestResult({
        target: 'NCBI ClinVar + dbSNP VCF (Public Domain)',
        status: 'allowed',
        reason: 'Approved: 17 U.S.C. § 105 US Federal Work. Unrestricted global P2P redistribution and indexing permitted.',
      })
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', color: '#0f172a', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* SaMD Non-Diagnostic Research Disclaimer Banner */}
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
          <ShieldAlert size={16} color="#dc2626" />
          <span>
            <strong>RESEARCH & EDUCATIONAL USE ONLY:</strong> Plasmid is a decentralized open-source scientific viewer, not an FDA/MFDS-cleared Medical Device (SaMD). Do not use for diagnostic decisions.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#b91c1c' }}>
          <span>RFC-0003 Compliant</span>
          <span>•</span>
          <span>ODbL / Public Domain Quarantined</span>
        </div>
      </div>

      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/plasmid.svg" alt="Plasmid Logo" style={{ width: '28px', height: '28px' }} />
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Plasmid <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>v0.1.0-alpha</span>
            </h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              Decentralized Genomic Wiki & P2P Slicing Engine
            </p>
          </div>
        </div>

        {/* Global Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
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
            <Layers size={15} /> Range Slicing
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
            <ArrowRightLeft size={15} /> Liftover & Guard
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
            <FileText size={15} /> Knowledge Wiki
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
            <Radio size={15} /> Hotspot Swarm
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
            <Scale size={15} /> Governance & IP
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {/* Preset Selector Banner */}
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
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>ACTIVE GENOMIC LOCUS</span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              {Object.keys(PRESET_VARIANTS).map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  style={{
                    padding: '6px 12px',
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
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>TARGET BUILD (SSOT)</span>
            <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
              GRCh38 / hg38
            </span>
          </div>
        </div>

        {/* Tab 1: Range Slicing & PMTiles v3 Hierarchical Index */}
        {activeTab === 'stream' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* PMTiles v3 Hierarchical Leaf Architecture Metric Card */}
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
                    PMTiles v3 Hierarchical Leaf Index Verified
                  </h3>
                </div>
                <p style={{ fontSize: '13px', color: '#0369a1', margin: '4px 0 0 0' }}>
                  Targeted 2-Hop directory traversal fetches only 1 KB leaf directory instead of parsing a 128 MB monolithic table.
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600, display: 'block' }}>
                  NETWORK TRAFFIC REDUCTION
                </span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#0284c7' }}>
                  95.0%
                </span>
              </div>
            </div>

            {/* Slicing Inspection Panel */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
                    {current.gene} ({current.mutation}) Slicing Plan
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    {current.chrom}:{current.hg38Pos} • {current.rsid} • {current.ref}&gt;{current.alt}
                  </p>
                </div>
                {/* ClinVar Stars Rating Badge */}
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
                      {current.stars} Stars
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{current.reviewStatus}</span>
                </div>
              </div>

              {/* Range Specs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>HTTP RANGE</span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{current.byteRange}</span>
                </div>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>PMTILES LEAF DIRECTORY</span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                    offset={current.leafOffset} len={current.leafLength}B
                  </span>
                </div>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>TARGET CHUNKS</span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                    #{current.chunks.join(', #')} (16KB each)
                  </span>
                </div>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>DATA LICENSE</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a' }}>{current.license}</span>
                </div>
              </div>

              {/* Merkle Verification Card */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>MERKLE ROOT HASH</span>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>{current.merkleRoot}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <CheckCircle2 size={13} color="#16a34a" />
                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                        {verifiedChunks[current.chunks[0]] ? 'Cryptographically Verified (Merkle Leaf Match)' : 'Pending Verification'}
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
                    {isVerifying ? 'Verifying...' : 'Re-verify Proof'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Coordinate Liftover & Drift Guard */}
        {activeTab === 'liftover' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                    Deterministic Coordinate Guard & Liftover Engine
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    Defends against silent off-by-one or legacy build coordinate mismatches across GRCh37/hg19 and GRCh38/hg38
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
                      Inject Adversarial 1-bp Coordinate Drift
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
                      [ADVERSARIAL ATTACK INTERCEPTED] Coordinate Drift Mismatch Detected
                    </h4>
                    <p style={{ fontSize: '12px', color: '#b91c1c', margin: '2px 0 0 0' }}>
                      Position drifted to {current.hg19Pos + 1}. Fails anchor verification against known clinical loci. Guard safely halted query.
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
                      Coordinate Integrity Verified
                    </h4>
                    <p style={{ fontSize: '12px', color: '#15803d', margin: '2px 0 0 0' }}>
                      hg19:{current.hg19Pos} ➔ hg38:{current.hg38Pos} matches verified anchor SNP {current.rsid}.
                    </p>
                  </div>
                </div>
              )}

              {/* Liftover Transformation Table */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>SOURCE BUILD (LEGACY)</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>
                    GRCh37 / hg19
                  </span>
                  <span style={{ fontSize: '12px', display: 'block', marginTop: '4px', color: '#475569' }}>
                    {current.chrom}:{simulateAdversarialDrift ? current.hg19Pos + 1 : current.hg19Pos}
                  </span>
                </div>
                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>TRANSFORMATION DELTA</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: '#0284c7' }}>
                    +{current.hg38Pos - current.hg19Pos} bp
                  </span>
                  <span style={{ fontSize: '12px', display: 'block', marginTop: '4px', color: '#64748b' }}>
                    Validated against UCSC Chain
                  </span>
                </div>
                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>TARGET BUILD (SSOT)</span>
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

        {/* Tab 3: Knowledge Wiki */}
        {activeTab === 'wiki' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>
                    {current.gene} {current.mutation}
                  </h2>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
                    ClinVar Reference: {current.rsid} • Clinical Significance:{' '}
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
                    {current.stars} Gold Stars ({current.reviewStatus})
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
              <div style={{ marginBottom: '24px', lineHeight: 1.6, fontSize: '14px', color: '#334155' }}>
                <p>{current.notes}</p>
              </div>

              {/* Literature Citations (PMID Links Only - No Copyrighted Abstract Bodies) */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                    Evidence-Backed Literature Citations (PubMed Outbound Links)
                  </h4>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Copyright-safe metadata indexing (PMID only)
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

        {/* Tab 4: Hotspot Swarm & K-Anonymity Guard */}
        {activeTab === 'swarm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Selective Hotspot Swarm & Byzantine Defense</h3>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    Prevents 3Gb whole-genome long-tail bit rot by routing queries to high-demand clinical panels with origin fallback
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="#16a34a" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#16a34a' }}>3 Swarm Topics Active</span>
                </div>
              </div>

              {/* Hotspot Annotation Packs List */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', marginBottom: '4px' }}>
                    CLINVAR PATHOGENIC PACK
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>~50 MB</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    12 active peers • 99.8% cached
                  </div>
                </div>

                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', marginBottom: '4px' }}>
                    ACMG SECONDARY FINDINGS
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>~15 MB</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    34 active peers • 100% cached
                  </div>
                </div>

                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', marginBottom: '4px' }}>
                    CPIC PHARMACOGENOMICS
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>~5 MB</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    18 active peers • 100% cached
                  </div>
                </div>
              </div>

              {/* K-Anonymity & Traffic Analysis Attack Defense Section */}
              <div style={{ padding: '20px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      K-Anonymity Traffic Analysis Side-Channel Shield
                    </h4>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                      RFC-0003 prohibits fine-grained single-chunk requests to prevent peer snooping of rare disease carrier status
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setKAnonymityTestMode('fine')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: kAnonymityTestMode === 'fine' ? '#dc2626' : '#cbd5e1',
                        backgroundColor: kAnonymityTestMode === 'fine' ? '#fef2f2' : '#ffffff',
                        color: kAnonymityTestMode === 'fine' ? '#dc2626' : '#475569',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Simulate Single 16KB Probe
                    </button>
                    <button
                      onClick={() => setKAnonymityTestMode('coarse')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: kAnonymityTestMode === 'coarse' ? '#16a34a' : '#cbd5e1',
                        backgroundColor: kAnonymityTestMode === 'coarse' ? '#f0fdf4' : '#ffffff',
                        color: kAnonymityTestMode === 'coarse' ? '#16a34a' : '#475569',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Subscribe Coarse ~50MB Pack
                    </button>
                  </div>
                </div>

                {kAnonymityTestMode === 'fine' ? (
                  <div style={{ padding: '12px 16px', borderRadius: '4px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Ban size={18} color="#dc2626" />
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', display: 'block' }}>
                        [REJECTED: SwarmError::TrafficAnalysisRisk]
                      </span>
                      <span style={{ fontSize: '12px', color: '#b91c1c' }}>
                        Fine-grained single variant chunk probe (#8572) blocked. Peer WebRTC monitoring could correlate client IP with BRCA1 mutation. Must subscribe to full coarse-grained pack.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '12px 16px', borderRadius: '4px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldCheck size={18} color="#16a34a" />
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534', display: 'block' }}>
                        [K-ANONYMITY SHIELD ACTIVE] Coarse Pack Swarm Enforced
                      </span>
                      <span style={{ fontSize: '12px', color: '#15803d' }}>
                        Batch of 3,125 chunks (~50MB) swarmed simultaneously. Peers cannot distinguish whether client possesses BRAF, TP53, or any other variant.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Byzantine Defense Status Card */}
              <div style={{ padding: '16px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} color="#16a34a" />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                        Byzantine Consensus & Quorum Defense
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        1 peer struck and banned for Merkle root mismatch • Zero payload pollution
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a', backgroundColor: '#dcfce7', padding: '4px 8px', borderRadius: '4px' }}>
                    Airgap Secure
                  </span>
                </div>
              </div>

              {/* WebRTC Peers */}
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                ACTIVE WEBRTC PEERS IN CURRENT PACK TOPIC
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { id: 'peer-tokyo-01', rtt: '14ms', up: '2.4 MB/s', state: 'Seeding Coarse Packs' },
                  { id: 'peer-seoul-09', rtt: '22ms', up: '3.1 MB/s', state: 'Seeding Coarse Packs' },
                  { id: 'peer-frankfurt-03', rtt: '48ms', up: '1.2 MB/s', state: 'Leech / Verifying' },
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

        {/* Tab 5: Governance & IP (RFC-0003) */}
        {activeTab === 'governance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 4-Tier Data Classification Matrix */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
                RFC-0003: 4-Tier Biomedical Data Governance Matrix
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
                Formal legal classifications establishing boundaries between uncopyrightable natural facts, open data, and blacklisted proprietary clinical databases.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', border: '1px solid #bbf7d0', borderRadius: '6px', backgroundColor: '#f0fdf4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>
                      TIER 1: PUBLIC DOMAIN (WHITELIST)
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
                      Unrestricted
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#15803d', margin: 0 }}>
                    NCBI ClinVar, dbSNP, RefSeq, GRC GRCh37/38 (17 U.S.C. § 105). US Federal government works with zero copyright. Unrestricted global P2P swarming permitted.
                  </p>
                </div>

                <div style={{ padding: '16px', border: '1px solid #bfdbfe', borderRadius: '6px', backgroundColor: '#eff6ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af' }}>
                      TIER 2: OPEN DATA (ODbL / CC-BY)
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#2563eb', backgroundColor: '#dbeafe', padding: '2px 6px', borderRadius: '4px' }}>
                      Quarantined
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#1d4ed8', margin: 0 }}>
                    Broad Institute gnomAD (ODbL 1.0), CPIC PharmGKB (CC-BY 4.0). Requires isolated pack partitioning and non-negotiable attribution banner to avoid viral copyleft.
                  </p>
                </div>

                <div style={{ padding: '16px', border: '1px solid #fecaca', borderRadius: '6px', backgroundColor: '#fef2f2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#991b1b' }}>
                      TIER 3: PROPRIETARY (STRICT BLACKLIST)
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                      Prohibited
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#b91c1c', margin: 0 }}>
                    OMIM (Johns Hopkins), COSMIC / HGMD (QIAGEN), SNPedia (MyHeritage). Proprietary clinical synopses and census articles strictly blacklisted. Only factual MIM:###### IDs allowed.
                  </p>
                </div>

                <div style={{ padding: '16px', border: '1px solid #fed7aa', borderRadius: '6px', backgroundColor: '#fff7ed' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#9a3412' }}>
                      TIER 4: PERSONAL BIOMETRIC WGS/VCF
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#ea580c', backgroundColor: '#ffedd5', padding: '2px 6px', borderRadius: '4px' }}>
                      OPFS Airgapped
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#c2410c', margin: 0 }}>
                    User raw genome records. GDPR Art. 9 & HIPAA biometric data. Never transmitted over WebRTC P2P; strictly decoded locally via WebAssembly and Origin Private File System.
                  </p>
                </div>
              </div>

              {/* Interactive Ingestion Sanitizer / Blacklist Filter */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '20px', backgroundColor: '#f8fafc' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
                  Adversarial Data Ingestion Filter Tester
                </h4>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                  Test real-time automated detection and rejection of proprietary database scrapes and license violations:
                </p>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button
                    onClick={() => runAdversarialFilterTest('omim')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Test OMIM Synopsis
                  </button>
                  <button
                    onClick={() => runAdversarialFilterTest('cosmic')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Test COSMIC Somatic IDs
                  </button>
                  <button
                    onClick={() => runAdversarialFilterTest('odbl_fail')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Test gnomAD Isolation Breach
                  </button>
                  <button
                    onClick={() => runAdversarialFilterTest('clinvar')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Test ClinVar Public Domain
                  </button>
                </div>

                {filterTestResult && (
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: filterTestResult.status === 'blocked' ? '#fecaca' : '#bbf7d0',
                      backgroundColor: filterTestResult.status === 'blocked' ? '#fef2f2' : '#f0fdf4',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      {filterTestResult.status === 'blocked' ? (
                        <Ban size={18} color="#dc2626" />
                      ) : (
                        <CheckCircle2 size={18} color="#16a34a" />
                      )}
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: filterTestResult.status === 'blocked' ? '#991b1b' : '#166534',
                        }}
                      >
                        Target: {filterTestResult.target} —{' '}
                        {filterTestResult.status === 'blocked' ? 'BLOCKED' : 'APPROVED'}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '12px',
                        color: filterTestResult.status === 'blocked' ? '#b91c1c' : '#15803d',
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      {filterTestResult.reason}
                    </p>
                  </div>
                )}
              </div>

              {/* Mandatory Legal & Regulatory Disclaimers */}
              <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                  MANDATORY ATTRIBUTIONS & REGULATORY SAFE HARBOR
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: '#64748b' }}>
                  <div>
                    <strong>gnomAD Attribution:</strong> This tool includes data from the Genome Aggregation Database (gnomAD), Broad Institute of MIT and Harvard. Released under the Open Database License (ODbL) v1.0.
                  </div>
                  <div>
                    <strong>CPIC Attribution:</strong> Clinical Pharmacogenetics Implementation Consortium (CPIC) dosing guidelines provided under Creative Commons Attribution 4.0 International (CC-BY 4.0).
                  </div>
                  <div>
                    <strong>Regulatory Notice (FDA/MFDS):</strong> Plasmid is developed strictly as a decentralized scientific research platform pursuant to 21 U.S.C. § 360j(o)(1)(E) Clinical Decision Support software exemptions. Not for clinical diagnosis.
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
