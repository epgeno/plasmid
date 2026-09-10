import { useState } from 'react'
import {
  Share2,
  Disc,
  Cpu,
  Layers,
  CheckCircle2,
  ShieldCheck,
  FileText,
  Activity,
  HardDrive,
  ExternalLink,
} from 'lucide-react'

interface VariantData {
  gene: string
  mutation: string
  chrom: string
  pos: number
  ref: string
  alt: string
  rsid: string
  clinvar: 'Pathogenic' | 'Likely Pathogenic' | 'Uncertain Significance' | 'Benign'
  acmg: string[]
  chunks: number[]
  byteRange: string
  merkleRoot: string
  pubmed: { id: string; title: string; year: number }[]
  notes: string
}

const PRESET_VARIANTS: Record<string, VariantData> = {
  'BRAF V600E': {
    gene: 'BRAF',
    mutation: 'V600E',
    chrom: 'chr7',
    pos: 140453136,
    ref: 'T',
    alt: 'A',
    rsid: 'rs113488022',
    clinvar: 'Pathogenic',
    acmg: ['PS1', 'PS3', 'PM1', 'PM2', 'PP3'],
    chunks: [8572, 8573],
    byteRange: 'bytes=140451840-140484607',
    merkleRoot: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
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
    pos: 7673770,
    ref: 'C',
    alt: 'T',
    rsid: 'rs28934578',
    clinvar: 'Pathogenic',
    acmg: ['PS1', 'PS3', 'PM1', 'PM5', 'PP3'],
    chunks: [468, 469],
    byteRange: 'bytes=7667712-7700479',
    merkleRoot: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    pubmed: [
      { id: '20427387', title: 'The p53 tumor suppressor protein: meeting review', year: 2010 },
      { id: '31575995', title: 'Structure and conformational dynamics of p53 DNA-binding domain', year: 2019 },
    ],
    notes: 'Structural hotspot mutation disrupting the zinc coordination sphere of the DNA-binding domain, causing global conformational destabilization.',
  },
  'EGFR T790M': {
    gene: 'EGFR',
    mutation: 'T790M',
    chrom: 'chr7',
    pos: 55181378,
    ref: 'C',
    alt: 'T',
    rsid: 'rs121434569',
    clinvar: 'Pathogenic',
    acmg: ['PS1', 'PS3', 'PM1', 'PP3'],
    chunks: [3368, 3369],
    byteRange: 'bytes=55181312-55214079',
    merkleRoot: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    pubmed: [
      { id: '15728397', title: 'EGFR mutation and resistance of non-small-cell lung cancer to gefitinib or erlotinib', year: 2005 },
    ],
    notes: 'Gatekeeper residue mutation causing steric hindrance to first-generation TKIs (gefitinib/erlotinib) and increasing ATP affinity.',
  },
}

export default function App() {
  const [selectedKey, setSelectedKey] = useState<string>('BRAF V600E')
  const [activeTab, setActiveTab] = useState<'stream' | 'wiki' | 'swarm'>('stream')
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifiedChunks, setVerifiedChunks] = useState<Record<number, boolean>>({
    8572: true,
    8573: true,
    468: true,
    469: true,
    3368: true,
    3369: true,
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
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', color: '#0f172a' }}>
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Disc size={22} color="#0f172a" fill="none" />
          <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em' }}>PLASMID</span>
          <span
            style={{
              fontSize: '12px',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              padding: '2px 8px',
              borderRadius: '4px',
              fontFamily: 'monospace',
            }}
          >
            v0.1.0-alpha
          </span>
        </div>

        <nav style={{ display: 'flex', gap: '24px', fontSize: '14px', fontWeight: 500 }}>
          <button
            onClick={() => setActiveTab('stream')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: activeTab === 'stream' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'stream' ? 700 : 500,
              paddingBottom: '4px',
              borderBottom: activeTab === 'stream' ? '2px solid #0f172a' : '2px solid transparent',
            }}
          >
            Byte Slicing
          </button>
          <button
            onClick={() => setActiveTab('wiki')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: activeTab === 'wiki' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'wiki' ? 700 : 500,
              paddingBottom: '4px',
              borderBottom: activeTab === 'wiki' ? '2px solid #0f172a' : '2px solid transparent',
            }}
          >
            Knowledge Wiki
          </button>
          <button
            onClick={() => setActiveTab('swarm')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: activeTab === 'swarm' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'swarm' ? 700 : 500,
              paddingBottom: '4px',
              borderBottom: activeTab === 'swarm' ? '2px solid #0f172a' : '2px solid transparent',
            }}
          >
            P2P Swarm
          </button>
        </nav>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1040px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Title */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '8px' }}>
            Decentralized Genomic Knowledge Mesh
          </h1>
          <p style={{ fontSize: '15px', color: '#64748b', lineHeight: 1.5 }}>
            Sub-second byte-range CRAM slicing, BitTorrent v2 BEP 52 Merkle trees, and ClinVar local-first graph.
          </p>
        </div>

        {/* Preset Selector Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginRight: '4px' }}>
            Presets:
          </span>
          {Object.keys(PRESET_VARIANTS).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedKey(key)}
              style={{
                fontSize: '13px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: selectedKey === key ? '1px solid #0f172a' : '1px solid #e2e8f0',
                backgroundColor: selectedKey === key ? '#0f172a' : '#ffffff',
                color: selectedKey === key ? '#ffffff' : '#334155',
                fontWeight: selectedKey === key ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Top Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '8px' }}>
              <Layers size={16} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>CRAM Slicing Latency</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>12.4 ms</div>
            <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px', fontFamily: 'monospace' }}>
              Range: {current.byteRange} (32 KB)
            </div>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '8px' }}>
              <Share2 size={16} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>P2P Swarm Peers</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>18 Seeding</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              WebRTC Datachannel (BEP 52 16KB)
            </div>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '8px' }}>
              <Cpu size={16} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>WASM Slicing Core</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>plasmid-core</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              noodles-vcf zero-copy in Worker
            </div>
          </div>
        </div>

        {/* Tab 1: Byte Slicing */}
        {activeTab === 'stream' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
                    {current.chrom}:{current.pos} ({current.gene} {current.mutation})
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    dbSNP {current.rsid} • Ref: {current.ref} → Alt: {current.alt} • GRCh38
                  </p>
                </div>
                <button
                  onClick={handleVerifyMerkle}
                  disabled={isVerifying}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    backgroundColor: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <ShieldCheck size={16} color="#0f172a" />
                  {isVerifying ? 'Verifying Proof...' : 'Verify Merkle Proof'}
                </button>
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

              {/* Genomic Sequence Alignment Visualizer */}
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

        {/* Tab 2: Knowledge Wiki */}
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
                  <h2 style={{ fontSize: '22px', fontWeight: 700 }}>
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

        {/* Tab 3: P2P Swarm */}
        {activeTab === 'swarm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Local-First Swarm Mesh</h3>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    BitTorrent v2 BEP 52 over WebRTC Datachannels & Origin Fast-Path
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="#16a34a" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#16a34a' }}>Swarm Active</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                    <HardDrive size={14} /> LOCAL OPFS CACHE (ISOLATED)
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>144 KB Cached</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Air-gapped from personal uploads
                  </div>
                </div>

                <div style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                    <Share2 size={14} /> P2P OFF-LOAD RATIO
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>91.4% Saved</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Cloudflare R2 bandwidth saved
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                ACTIVE WEBRTC PEERS IN CURRENT MERKLE RANGE
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { id: 'peer-8b4a', rtt: '14ms', up: '2.4 MB/s', state: 'Seeding 16KB Chunks' },
                  { id: 'peer-c102', rtt: '28ms', up: '1.8 MB/s', state: 'Seeding 16KB Chunks' },
                  { id: 'peer-77f1', rtt: '42ms', up: '950 KB/s', state: 'Leech / Verifying' },
                ].map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
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
