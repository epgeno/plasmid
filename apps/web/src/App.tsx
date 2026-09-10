import { useState } from 'react'
import { Search, Share2, Disc, Cpu, Layers } from 'lucide-react'

export default function App() {
  const [query, setQuery] = useState('chr7:140453136')
  const [activeTab, setActiveTab] = useState<'stream' | 'wiki' | 'swarm'>('stream')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', color: '#0f172a' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Disc size={22} color="#0f172a" fill="none" />
          <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em' }}>PLASMID</span>
          <span style={{ fontSize: '12px', color: '#64748b', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '4px' }}>v0.1.0-alpha</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <nav style={{ display: 'flex', gap: '16px', fontSize: '14px', fontWeight: 500 }}>
            <button 
              onClick={() => setActiveTab('stream')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: activeTab === 'stream' ? '#0f172a' : '#64748b', fontWeight: activeTab === 'stream' ? 700 : 500 }}
            >
              Byte Slicing
            </button>
            <button 
              onClick={() => setActiveTab('wiki')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: activeTab === 'wiki' ? '#0f172a' : '#64748b', fontWeight: activeTab === 'wiki' ? 700 : 500 }}
            >
              Knowledge Wiki
            </button>
            <button 
              onClick={() => setActiveTab('swarm')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: activeTab === 'swarm' ? '#0f172a' : '#64748b', fontWeight: activeTab === 'swarm' ? 700 : 500 }}
            >
              P2P Swarm
            </button>
          </nav>
        </div>
      </header>

      {/* Hero & Search bar */}
      <main style={{ maxWidth: '1040px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '8px' }}>
            Decentralized Genomic Knowledge Mesh
          </h1>
          <p style={{ fontSize: '15px', color: '#64748b' }}>
            High-density byte-range CRAM streaming with BitTorrent v2 Merkle verification.
          </p>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search gene, rsID, or genomic coordinates (e.g. BRAF V600E, chr7:140453136)"
              style={{
                width: '100%',
                padding: '12px 14px 12px 42px',
                fontSize: '14px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
              }}
            />
          </div>
          <button style={{ padding: '0 20px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
            Fetch Slice
          </button>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '8px' }}>
              <Layers size={16} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>CRAM Slicing Latency</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>12.4 ms</div>
            <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>Range Request: 64 KB fetched</div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '8px' }}>
              <Share2 size={16} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>P2P Swarm Peers</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>18 Seeding</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>WebRTC + BitTorrent v2 BEP 52</div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '8px' }}>
              <Cpu size={16} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>WASM Decoder</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>noodles-wasm</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Zero-copy in Worker thread</div>
          </div>
        </div>

        {/* Feature Inspection Track */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Inspection Canvas: {query}</h3>
            <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>Merkle Root: 7f83b165...9482</span>
          </div>
          <div style={{ height: '140px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '14px' }}>
            WebGL / Canvas Genomic Track Viewport
          </div>
        </div>
      </main>
    </div>
  )
}
