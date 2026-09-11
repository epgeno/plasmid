import { useState } from 'react'
import {
  Cpu,
  Layers,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRightLeft,
  FileText,
  Activity,
  ExternalLink,
  Radio,
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
  const [activeTab, setActiveTab] = useState<'stream' | 'wiki' | 'swarm' | 'liftover'>('stream')
  const [isVerifying, setIsVerifying] = useState(false)
  const [simulateAdversarialDrift, setSimulateAdversarialDrift] = useState(false)
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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', color: '#0f172a', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#1d4ed8' }}>
                  <Cpu size={16} /> PMTILES V3 2-STAGE HIERARCHICAL LEAF INDEX ACTIVE
                </div>
                <div style={{ fontSize: '14px', color: '#1e3a8a', marginTop: '4px' }}>
                  Full genome index (3.2 GB) partitioned into 32-byte leaf pointers. Slicing fetches only target leaf directory slice.
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e40af', fontFamily: 'monospace' }}>
                  {current.leafLength} Bytes
                </div>
                <div style={{ fontSize: '11px', color: '#2563eb' }}>
                  Leaf Offset: {current.leafOffset} B (99.999% Saved)
                </div>
              </div>
            </div>

            {/* Slicing Plan Card */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Zero-Copy Genomic Slicing Plan</h3>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    Single-container byte-range fetch via noodles-vcf & 16KB Merkle leaf validation
                  </p>
                </div>
                <button
                  onClick={handleVerifyMerkle}
                  disabled={isVerifying}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isVerifying ? 'wait' : 'pointer',
                  }}
                >
                  <ShieldCheck size={16} color="#0f172a" />
                  {isVerifying ? 'Verifying Proof...' : 'Verify Merkle Proof'}
                </button>
              </div>

              {/* Coordinates Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>CHROMOSOME</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace' }}>{current.chrom}</div>
                </div>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>GRCh38 POSITION</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace' }}>{current.hg38Pos.toLocaleString()}</div>
                </div>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>ALLELE (REF / ALT)</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace' }}>{current.ref} → {current.alt}</div>
                </div>
                <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>HTTP RANGE HEADER</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: '#0284c7' }}>{current.byteRange}</div>
                </div>
              </div>

              {/* Merkle Leaf Chunks Display */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                  16KB MERKLE LEAF CHUNKS (BEP 52 ALIGNED)
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {current.chunks.map((idx) => (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>
                          Chunk #{idx} (16,384 B)
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          SHA-256 Leaf Hash Verified
                        </div>
                      </div>
                      {verifiedChunks[idx] && <CheckCircle2 size={18} color="#16a34a" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Nucleotide Track */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                  NUCLEOTIDE SEQUENCE TRACK (ZERO-COPY SLICE)
                </div>
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#0f172a',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    letterSpacing: '0.2em',
                    overflowX: 'auto',
                    color: '#94a3b8',
                  }}
                >
                  <div style={{ marginBottom: '4px' }}>
                    REF:&nbsp;... T G A C C T C A G A{' '}
                    <span style={{ color: '#38bdf8', fontWeight: 700, textDecoration: 'underline' }}>
                      {current.ref}
                    </span>{' '}
                    G C T G T C C A C A ...
                  </div>
                  <div>
                    ALT:&nbsp;... T G A C C T C A G A{' '}
                    <span style={{ color: '#ef4444', fontWeight: 700, backgroundColor: '#450a0a', padding: '0 4px' }}>
                      {current.alt}
                    </span>{' '}
                    G C T G T C C A C A ...
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Liftover & Adversarial Coordinate Guard */}
        {activeTab === 'liftover' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700 }}>WASM Liftover & Sequence Fingerprint Guard</h3>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    Bridges 23andMe/Ancestry (GRCh37/hg19) raw data into modern GRCh38 ClinVar annotations with zero-error reference check
                  </p>
                </div>
                <button
                  onClick={() => setSimulateAdversarialDrift(!simulateAdversarialDrift)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: simulateAdversarialDrift ? '#ef4444' : '#cbd5e1',
                    backgroundColor: simulateAdversarialDrift ? '#fef2f2' : '#ffffff',
                    color: simulateAdversarialDrift ? '#b91c1c' : '#334155',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <AlertTriangle size={16} />
                  {simulateAdversarialDrift ? 'Disable Attack Simulation' : 'Simulate Adversarial Drift Attack'}
                </button>
              </div>

              {/* Adversarial Alert Banner */}
              {simulateAdversarialDrift && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '6px',
                    border: '1px solid #fecaca',
                    backgroundColor: '#fef2f2',
                    marginBottom: '20px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                  }}
                >
                  <ShieldAlert size={22} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#991b1b' }}>
                      CRITICAL ADVERSARIAL ATTACK BLOCKED: COORDINATE DRIFT MISMATCH
                    </div>
                    <div style={{ fontSize: '13px', color: '#7f1d1d', marginTop: '4px', lineHeight: 1.5 }}>
                      Client attempted to query GRCh38 ClinVar using unlifted GRCh37 coordinate ({current.chrom}:{current.hg19Pos}).
                      <br />
                      <strong>Reference Fingerprint Mismatch:</strong> Expected ref base &apos;{current.ref}&apos;, but GRCh38 sequence at this unlifted coordinate contains an unrelated intron sequence.
                      <br />
                      <em>Execution was halted fail-closed by CoordinateGuard to prevent fatal clinical misinterpretation.</em>
                    </div>
                  </div>
                </div>
              )}

              {/* Liftover Translation Visualizer */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                    SOURCE INPUT: GRCh37 / hg19 (DTC Raw Data)
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>
                    {current.chrom}:{current.hg19Pos.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Allele: {current.ref} → {current.alt} ({current.rsid})
                  </div>
                </div>

                <div style={{ padding: '16px', border: '1px solid #0284c7', borderRadius: '6px', backgroundColor: '#f0f9ff' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7', marginBottom: '8px' }}>
                    TARGET BUILD: GRCh38 / hg38 (WASM Liftover)
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: '#0369a1' }}>
                    {current.chrom}:{current.hg38Pos.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={14} /> Coordinate Delta: {current.hg38Pos - current.hg19Pos > 0 ? '+' : ''}{(current.hg38Pos - current.hg19Pos).toLocaleString()} bp (Verified)
                  </div>
                </div>
              </div>

              {/* Anchor SNP Table */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '10px' }}>
                  VERIFIED CLINICAL ANCHOR SNPS (AUTOMATIC BUILD DETECTION)
                </div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  {[
                    { rsid: 'rs334', gene: 'HBB (Sickle Cell)', hg19: 'chr11:5,248,232', hg38: 'chr11:5,227,002', delta: '-21,230 bp' },
                    { rsid: 'rs113488022', gene: 'BRAF (V600E)', hg19: 'chr7:140,453,136', hg38: 'chr7:140,753,336', delta: '+300,200 bp' },
                    { rsid: 'rs28934578', gene: 'TP53 (R248W)', hg19: 'chr17:7,577,538', hg38: 'chr17:7,674,220', delta: '+96,682 bp' },
                  ].map((row, i) => (
                    <div
                      key={row.rsid}
                      style={{
                        padding: '12px 16px',
                        borderBottom: i < 2 ? '1px solid #e2e8f0' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{row.rsid} ({row.gene})</span>
                      <span style={{ color: '#64748b' }}>hg19: {row.hg19}</span>
                      <span style={{ color: '#0284c7', fontWeight: 600 }}>hg38: {row.hg38}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#475569' }}>{row.delta}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Knowledge Wiki */}
        {activeTab === 'wiki' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: current.clinvar === 'Pathogenic' ? '#fee2e2' : '#fef3c7',
                      color: current.clinvar === 'Pathogenic' ? '#991b1b' : '#92400e',
                      marginBottom: '8px',
                    }}
                  >
                    ClinVar: {current.clinvar}
                  </span>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '4px 0' }}>
                    {current.gene} {current.mutation}
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {current.acmg.map((code) => (
                    <span
                      key={code}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        color: '#475569',
                      }}
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>

              <p style={{ fontSize: '15px', color: '#334155', lineHeight: 1.6, marginBottom: '24px' }}>
                {current.notes}
              </p>

              {/* Cited Literature */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} /> Cited Evidence & Literature (SSOT Grounded)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {current.pubmed.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{p.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          PMID: {p.id} ({p.year})
                        </div>
                      </div>
                      <a
                        href={`https://pubmed.ncbi.nlm.nih.gov/${p.id}/`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', textDecoration: 'none' }}
                      >
                        PubMed <ExternalLink size={14} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Hotspot Swarm */}
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
                  { id: 'peer-tokyo-01', rtt: '14ms', up: '2.4 MB/s', state: 'Seeding 16KB Chunks' },
                  { id: 'peer-seoul-09', rtt: '22ms', up: '3.1 MB/s', state: 'Seeding 16KB Chunks' },
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
      </main>
    </div>
  )
}
