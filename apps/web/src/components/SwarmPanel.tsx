import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { TRANSLATIONS, type SupportedLanguage } from '../i18n'
import type { ContainerSession } from '../services/plasmidContainerClient'
import {
  webRtcSwarmClient,
  type BatchTransferResult,
  type SwarmSnapshot,
} from '../services/webrtcSwarm'

export interface SwarmPanelProps {
  lang: SupportedLanguage
  session: ContainerSession | null
  activeVariantChunkIndex: number | null
  snapshot: SwarmSnapshot
}

function formatByteCount(bytes: number): string {
  if (bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function SwarmPanel({
  lang,
  session,
  activeVariantChunkIndex,
  snapshot,
}: SwarmPanelProps) {
  const t = TRANSLATIONS[lang]
  const st = t.swarm

  const [roomInput, setRoomInput] = useState<string>(snapshot.room || 'clinvar-grch38')
  const [selectedPairIndex, setSelectedPairIndex] = useState<number>(0)
  const [transferLoading, setTransferLoading] = useState<boolean>(false)
  const [lastResult, setLastResult] = useState<BatchTransferResult | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const totalChunks = snapshot.header?.total_chunks ?? session?.header.total_chunks ?? 90

  const batchPairs = useMemo<[number, number][]>(() => {
    const maxIdx = Math.max(1, totalChunks - 1)
    const pairs: [number, number][] = []
    if (
      activeVariantChunkIndex !== null &&
      activeVariantChunkIndex >= 0 &&
      activeVariantChunkIndex <= maxIdx
    ) {
      const neighbor =
        activeVariantChunkIndex + 1 <= maxIdx
          ? activeVariantChunkIndex + 1
          : Math.max(0, activeVariantChunkIndex - 1)
      const first = Math.min(activeVariantChunkIndex, neighbor)
      const second = Math.max(activeVariantChunkIndex, neighbor)
      if (first !== second) {
        pairs.push([first, second])
      }
    }

    const candidates: [number, number][] = [
      [0, 1],
      [2, 3],
      [4, 5],
      [Math.max(0, maxIdx - 1), maxIdx],
    ]
    for (const [a, b] of candidates) {
      if (a < b && b <= maxIdx && !pairs.some(([pa, pb]) => pa === a && pb === b)) {
        pairs.push([a, b])
      }
    }
    return pairs.length > 0 ? pairs : [[0, 1]]
  }, [activeVariantChunkIndex, totalChunks])

  const activePair = batchPairs[Math.min(selectedPairIndex, batchPairs.length - 1)] ?? [0, 1]

  const connectedPeersCount = useMemo(
    () => snapshot.peers.filter((p) => p.status === 'connected').length,
    [snapshot.peers]
  )

  const bannedPeersCount = useMemo(
    () => snapshot.peers.filter((p) => p.status === 'banned').length,
    [snapshot.peers]
  )

  const connectedSeederCount = useMemo(
    () =>
      snapshot.peers.filter((p) => p.status === 'connected' && p.role === 'seeder').length,
    [snapshot.peers]
  )

  const minRttMs = useMemo<number | null>(() => {
    const rtts = snapshot.peers
      .filter((p) => p.status === 'connected' && p.rttMs !== null)
      .map((p) => p.rttMs as number)
    if (rtts.length === 0) return null
    return Math.min(...rtts)
  }, [snapshot.peers])

  const handleJoin = async (role: 'seeder' | 'leecher') => {
    setActionError(null)
    setLastResult(null)
    try {
      await webRtcSwarmClient.joinRoom({
        room: roomInput,
        role,
      })
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleLeave = async () => {
    setActionError(null)
    setLastResult(null)
    await webRtcSwarmClient.leaveRoom()
  }

  const handleRequestBatch = async (simulateByzantine: boolean) => {
    setTransferLoading(true)
    setActionError(null)
    try {
      const res = await webRtcSwarmClient.requestChunkBatch(
        [activePair[0], activePair[1]],
        { simulateByzantine }
      )
      setLastResult(res)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setTransferLoading(false)
    }
  }

  const handleSingleChunkProbe = async () => {
    setTransferLoading(true)
    setActionError(null)
    try {
      await webRtcSwarmClient.requestChunkBatch([activePair[0]], {
        rawSingleChunkProbe: true,
      })
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setTransferLoading(false)
    }
  }

  const canRequestFromSeeder =
    snapshot.joined && connectedSeederCount > 0 && !transferLoading

  return (
    <div>
      {/* 1. Live WebRTC P2P Swarm Console */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px',
          marginBottom: '20px',
          backgroundColor: '#ffffff',
        }}
      >
        {/* Top Title + Status Pill */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '14px',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 260px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                marginBottom: '4px',
              }}
            >
              <Radio size={17} color="#2563eb" style={{ flexShrink: 0 }} />
              <h2
                className="cjk-keep"
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  margin: 0,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                }}
              >
                {st.title}
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              {st.desc}
            </p>
          </div>

          <span
            data-testid="swarm-status-badge"
            className="tabular-nums"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '9999px',
              backgroundColor: snapshot.joined
                ? snapshot.role === 'seeder'
                  ? '#f0fdf4'
                  : '#eff6ff'
                : '#f8fafc',
              color: snapshot.joined
                ? snapshot.role === 'seeder'
                  ? '#166534'
                  : '#1d4ed8'
                : '#475569',
              border: snapshot.joined
                ? snapshot.role === 'seeder'
                  ? '1px solid #bbf7d0'
                  : '1px solid #bfdbfe'
                : '1px solid #cbd5e1',
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            {snapshot.joined ? (
              <Wifi size={13} style={{ flexShrink: 0 }} />
            ) : (
              <WifiOff size={13} style={{ flexShrink: 0 }} />
            )}
            <span>
              {snapshot.joining
                ? st.statusJoining
                : snapshot.joined
                  ? snapshot.role === 'seeder'
                    ? st.statusSeeding(snapshot.seederChunksReady)
                    : st.statusLeeching
                  : st.statusOffline}
            </span>
          </span>
        </div>

        {/* RFC-0002 / RFC-0003 Air-Gap Isolation Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '9px 12px',
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            marginBottom: '16px',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#334155',
              minWidth: 0,
            }}
          >
            <ShieldCheck size={14} color="#16a34a" style={{ flexShrink: 0 }} />
            <span style={{ wordBreak: 'break-word' }}>{st.publicOnlyBadge}</span>
          </span>

          <span
            className="tabular-nums"
            style={{
              fontSize: '11px',
              fontFamily: 'ui-monospace, monospace',
              color: '#64748b',
              wordBreak: 'break-all',
            }}
          >
            {st.localPeerLabel}: {snapshot.localPeerId}
          </span>
        </div>

        {/* Swarm Room Input & Seeder / Leecher Participation Controls */}
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            marginBottom: '16px',
          }}
        >
          <div style={{ marginBottom: '10px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#0f172a',
                display: 'block',
                marginBottom: '2px',
              }}
            >
              {st.liveConsoleTitle}
            </span>
            <span style={{ fontSize: '12px', color: '#475569' }}>{st.liveConsoleDesc}</span>
          </div>

          <div className="plasmid-swarm-room-bar">
            <div style={{ minWidth: 0, flex: '1 1 180px' }}>
              <label
                htmlFor="plasmid-swarm-room-input"
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: '4px',
                }}
              >
                {st.roomLabel}
              </label>
              <input
                id="plasmid-swarm-room-input"
                data-testid="swarm-room-input"
                type="text"
                value={roomInput}
                placeholder={st.roomPlaceholder}
                onChange={(e) => setRoomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                  }
                }}
                style={{
                  width: '100%',
                  minWidth: 0,
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  fontFamily: 'ui-monospace, monospace',
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              />
            </div>

            <div className="plasmid-swarm-role-btns">
              <button
                type="button"
                data-testid="swarm-join-seeder-btn"
                disabled={snapshot.joining}
                onClick={() => void handleJoin('seeder')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border:
                    snapshot.joined && snapshot.role === 'seeder'
                      ? '1px solid #166534'
                      : '1px solid #0f172a',
                  backgroundColor:
                    snapshot.joined && snapshot.role === 'seeder' ? '#166534' : '#0f172a',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: snapshot.joining ? 'wait' : 'pointer',
                  minWidth: 0,
                }}
              >
                {st.joinSeederBtn}
              </button>

              <button
                type="button"
                data-testid="swarm-join-leecher-btn"
                disabled={snapshot.joining}
                onClick={() => void handleJoin('leecher')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border:
                    snapshot.joined && snapshot.role === 'leecher'
                      ? '1px solid #1d4ed8'
                      : '1px solid #2563eb',
                  backgroundColor:
                    snapshot.joined && snapshot.role === 'leecher' ? '#1d4ed8' : '#eff6ff',
                  color:
                    snapshot.joined && snapshot.role === 'leecher' ? '#ffffff' : '#1d4ed8',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: snapshot.joining ? 'wait' : 'pointer',
                  minWidth: 0,
                }}
              >
                {st.joinLeecherBtn}
              </button>

              {snapshot.joined && (
                <button
                  type="button"
                  data-testid="swarm-leave-btn"
                  onClick={() => void handleLeave()}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    minWidth: 0,
                  }}
                >
                  {st.leaveRoomBtn}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Telemetry 4-KPI Grid (Strictly Real Measurements) */}
        <div className="plasmid-clinvar-kpi-grid">
          <div
            data-testid="swarm-kpi-peers"
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
              {st.kpiPeersLabel}
            </span>
            <span
              className="tabular-nums"
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: '#0f172a',
                display: 'block',
                marginTop: '2px',
              }}
            >
              {connectedPeersCount}{' '}
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#be123c' }}>
                / {bannedPeersCount}
              </span>
            </span>
            <span
              className="tabular-nums"
              style={{ fontSize: '11px', color: '#475569', display: 'block', marginTop: '2px' }}
            >
              {st.kpiPeersSub(connectedPeersCount, bannedPeersCount)}
            </span>
          </div>

          <div
            data-testid="swarm-kpi-rtt"
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
              {st.kpiRttLabel}
            </span>
            <span
              className="tabular-nums"
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: minRttMs !== null ? '#166534' : '#0f172a',
                display: 'block',
                marginTop: '2px',
              }}
            >
              {minRttMs !== null ? `${minRttMs} ms` : '—'}
            </span>
            <span style={{ fontSize: '11px', color: '#475569', display: 'block', marginTop: '2px' }}>
              {st.kpiRttSub}
            </span>
          </div>

          <div
            data-testid="swarm-kpi-bytes"
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
              {st.kpiBytesLabel}
            </span>
            <span
              className="tabular-nums"
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: '#0f172a',
                display: 'block',
                marginTop: '2px',
              }}
            >
              {formatByteCount(snapshot.p2pBytesReceived + snapshot.p2pBytesSent)}
            </span>
            <span
              className="tabular-nums"
              style={{
                fontSize: '11px',
                color: '#475569',
                display: 'block',
                marginTop: '2px',
                wordBreak: 'break-word',
              }}
            >
              {st.kpiBytesSub(
                formatByteCount(snapshot.p2pBytesReceived),
                formatByteCount(snapshot.p2pBytesSent)
              )}
            </span>
          </div>

          <div
            data-testid="swarm-kpi-verify"
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
              {st.kpiVerifyLabel}
            </span>
            <span
              className="tabular-nums"
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: snapshot.chunksRejected > 0 ? '#be123c' : '#0f172a',
                display: 'block',
                marginTop: '2px',
              }}
            >
              {snapshot.chunksVerified}{' '}
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                / {snapshot.originFallbackCount}
              </span>
            </span>
            <span
              className="tabular-nums"
              style={{
                fontSize: '11px',
                color: '#475569',
                display: 'block',
                marginTop: '2px',
                wordBreak: 'break-word',
              }}
            >
              {st.kpiVerifySub(
                snapshot.chunksVerified,
                snapshot.chunksRejected,
                snapshot.originFallbackCount
              )}
            </span>
          </div>
        </div>

        {/* 16KB Chunk Exchange & Byzantine Fault Injection Section */}
        <div
          style={{
            padding: '14px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              {st.actionsTitle}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                wordBreak: 'break-word',
              }}
            >
              {st.kAnonBadge}
            </span>
          </div>

          {snapshot.role === 'seeder' && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  color: '#166534',
                  fontWeight: 600,
                  marginBottom: '8px',
                }}
              >
                {st.seederReadyNote(snapshot.seederChunksReady)}
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: snapshot.seederByzantineMode ? '#be123c' : '#334155',
                  cursor: 'pointer',
                }}
              >
                <input
                  data-testid="swarm-seeder-byzantine-toggle"
                  type="checkbox"
                  checked={snapshot.seederByzantineMode}
                  onChange={(e) =>
                    webRtcSwarmClient.setSeederByzantineMode(e.target.checked)
                  }
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <span style={{ wordBreak: 'break-word' }}>{st.seederByzantineToggle}</span>
              </label>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '10px',
            }}
          >
            <label
              htmlFor="plasmid-swarm-batch-select"
              style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}
            >
              {st.batchSelectLabel}:
            </label>
            <select
              id="plasmid-swarm-batch-select"
              data-testid="swarm-batch-select"
              value={selectedPairIndex}
              onChange={(e) => setSelectedPairIndex(Number(e.target.value))}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                fontSize: '12px',
                fontFamily: 'ui-monospace, monospace',
                fontWeight: 600,
                color: '#0f172a',
                maxWidth: '100%',
              }}
            >
              {batchPairs.map(([c1, c2], idx) => (
                <option key={`${c1}-${c2}`} value={idx}>
                  #{c1} + #{c2} (2 × 16 KB = 32 KB)
                </option>
              ))}
            </select>
          </div>

          <div className="plasmid-swarm-action-btns">
            <button
              type="button"
              data-testid="swarm-request-batch-btn"
              disabled={!canRequestFromSeeder}
              onClick={() => void handleRequestBatch(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 14px',
                borderRadius: '8px',
                border: canRequestFromSeeder ? '1px solid #2563eb' : '1px solid #cbd5e1',
                backgroundColor: canRequestFromSeeder ? '#2563eb' : '#f1f5f9',
                color: canRequestFromSeeder ? '#ffffff' : '#94a3b8',
                fontSize: '12px',
                fontWeight: 700,
                cursor: canRequestFromSeeder ? 'pointer' : 'not-allowed',
                minWidth: 0,
                textAlign: 'center',
              }}
            >
              <RefreshCw size={13} style={{ flexShrink: 0 }} />
              <span style={{ wordBreak: 'break-word' }}>
                {transferLoading
                  ? st.requestingBtn
                  : st.requestBatchBtn(activePair[0], activePair[1])}
              </span>
            </button>

            <button
              type="button"
              data-testid="swarm-byzantine-demo-btn"
              disabled={!canRequestFromSeeder}
              onClick={() => void handleRequestBatch(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 14px',
                borderRadius: '8px',
                border: canRequestFromSeeder ? '1px solid #fecdd3' : '1px solid #cbd5e1',
                backgroundColor: canRequestFromSeeder ? '#fff1f2' : '#f1f5f9',
                color: canRequestFromSeeder ? '#be123c' : '#94a3b8',
                fontSize: '12px',
                fontWeight: 700,
                cursor: canRequestFromSeeder ? 'pointer' : 'not-allowed',
                minWidth: 0,
                textAlign: 'center',
              }}
            >
              <ShieldAlert size={14} style={{ flexShrink: 0 }} />
              <span style={{ wordBreak: 'break-word' }}>{st.byzantineDemoBtn}</span>
            </button>

            <button
              type="button"
              data-testid="swarm-single-chunk-probe-btn"
              disabled={!canRequestFromSeeder}
              onClick={() => void handleSingleChunkProbe()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: canRequestFromSeeder ? '#ffffff' : '#f8fafc',
                color: canRequestFromSeeder ? '#334155' : '#94a3b8',
                fontSize: '12px',
                fontWeight: 600,
                cursor: canRequestFromSeeder ? 'pointer' : 'not-allowed',
                minWidth: 0,
                textAlign: 'center',
              }}
            >
              <Lock size={13} style={{ flexShrink: 0 }} />
              <span style={{ wordBreak: 'break-word' }}>{st.singleChunkProbeBtn}</span>
            </button>
          </div>

          {!canRequestFromSeeder && snapshot.role !== 'seeder' && (
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
              {st.connectSeederHint}
            </div>
          )}

          {lastResult && (
            <div
              data-testid="swarm-transfer-banner"
              data-transfer-source={lastResult.source}
              className="tabular-nums"
              style={{
                marginTop: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor:
                  lastResult.source === 'webrtc-p2p' ? '#f0fdf4' : '#fff7ed',
                border:
                  lastResult.source === 'webrtc-p2p'
                    ? '1px solid #bbf7d0'
                    : '1px solid #fed7aa',
                color: lastResult.source === 'webrtc-p2p' ? '#166534' : '#9a3412',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                {lastResult.source === 'webrtc-p2p'
                  ? st.lastTransferP2p(
                      lastResult.chunkIndices.map((c) => `#${c}`).join(', '),
                      formatByteCount(lastResult.p2pBytesReceived),
                      lastResult.elapsedMs
                    )
                  : st.lastTransferFallback(
                      lastResult.bannedPeerId ?? lastResult.peerId,
                      lastResult.rangeHeaders.join(', '),
                      formatByteCount(lastResult.originBytesFetched)
                    )}
              </span>
            </div>
          )}

          {(actionError || snapshot.error) && (
            <div
              role="alert"
              data-testid="swarm-error-banner"
              style={{
                marginTop: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#be123c',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                {actionError || snapshot.error}
              </span>
            </div>
          )}
        </div>

        {/* Live Connected & Banned Peers List */}
        <div data-testid="swarm-peers-list" style={{ marginBottom: '16px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#0f172a',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            {st.peersSectionTitle(snapshot.peers.length)}
          </span>

          {snapshot.peers.length === 0 ? (
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
                backgroundColor: '#f8fafc',
                fontSize: '12px',
                color: '#64748b',
              }}
            >
              {st.peersEmpty}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {snapshot.peers.map((peer) => {
                const isBanned = peer.status === 'banned'
                const isConnected = peer.status === 'connected'
                return (
                  <div
                    key={peer.peerId}
                    data-testid="swarm-peer-card"
                    data-peer-id={peer.peerId}
                    data-peer-status={peer.status}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: isBanned
                        ? '1px solid #fecdd3'
                        : isConnected
                          ? '1px solid #bbf7d0'
                          : '1px solid #e2e8f0',
                      backgroundColor: isBanned
                        ? '#fff1f2'
                        : isConnected
                          ? '#f8fafc'
                          : '#ffffff',
                      minWidth: 0,
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
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                          minWidth: 0,
                        }}
                      >
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: '12px',
                            fontFamily: 'ui-monospace, monospace',
                            fontWeight: 700,
                            color: '#0f172a',
                            wordBreak: 'break-all',
                          }}
                        >
                          {peer.peerId}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '1px 7px',
                            borderRadius: '4px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                          }}
                        >
                          {peer.role === 'seeder' ? st.peerRoleSeeder : st.peerRoleLeecher}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: isBanned
                            ? '#ffffff'
                            : isConnected
                              ? '#f0fdf4'
                              : '#eff6ff',
                          color: isBanned
                            ? '#be123c'
                            : isConnected
                              ? '#166534'
                              : '#1d4ed8',
                          border: isBanned
                            ? '1px solid #fecdd3'
                            : isConnected
                              ? '1px solid #bbf7d0'
                              : '1px solid #bfdbfe',
                        }}
                      >
                        {peer.status === 'connected'
                          ? st.peerStatusConnected
                          : peer.status === 'banned'
                            ? st.peerStatusBanned
                            : peer.status === 'connecting'
                              ? st.peerStatusConnecting
                              : st.peerStatusDisconnected}
                      </span>
                    </div>

                    <div
                      className="plasmid-swarm-peer-metrics tabular-nums"
                      style={{
                        marginTop: '8px',
                        fontSize: '11px',
                        color: '#475569',
                      }}
                    >
                      <span>
                        <strong>{st.peerRttCol}:</strong>{' '}
                        {peer.rttMs !== null ? `${peer.rttMs} ms` : '—'}
                      </span>
                      <span>
                        <strong>{st.peerTransferCol}:</strong> ↓{' '}
                        {formatByteCount(peer.bytesReceived)} / ↑{' '}
                        {formatByteCount(peer.bytesSent)}
                      </span>
                      <span>
                        <strong>{st.peerVerifyCol}:</strong> ✓ {peer.chunksVerified} · ✕{' '}
                        {peer.chunksRejected}
                      </span>
                    </div>

                    {peer.banReason && (
                      <div
                        className="tabular-nums"
                        style={{
                          marginTop: '6px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #fecdd3',
                          fontSize: '11px',
                          fontFamily: 'ui-monospace, monospace',
                          color: '#be123c',
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {peer.banReason}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Live Signaling & Cryptographic Verification Audit Log */}
        <div data-testid="swarm-audit-log">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px',
            }}
          >
            <Activity size={14} color="#475569" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
              {st.auditSectionTitle}
            </span>
          </div>

          <div
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              padding: '10px 12px',
            }}
          >
            {snapshot.logs.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#64748b' }}>{st.auditEmpty}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {snapshot.logs.map((entry) => {
                  const color =
                    entry.category === 'merkle-fail'
                      ? '#be123c'
                      : entry.category === 'merkle-pass'
                        ? '#166534'
                        : entry.category === 'fallback-206'
                          ? '#9a3412'
                          : entry.category === 'privacy-guard'
                            ? '#1d4ed8'
                            : '#334155'
                  return (
                    <div
                      key={entry.id}
                      className="tabular-nums"
                      style={{
                        fontSize: '11px',
                        fontFamily: 'ui-monospace, monospace',
                        color,
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      <span style={{ color: '#64748b' }}>[{entry.timestamp}]</span>{' '}
                      <span>{entry.message}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Container Merkle Geometry & RFC-0002/0003 Architecture Summary */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px',
          marginBottom: '24px',
          backgroundColor: '#ffffff',
        }}
      >
        {session && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                padding: '14px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                minWidth: 0,
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
                {st.containerPackTitle}
              </span>
              <span
                className="tabular-nums"
                style={{
                  fontSize: '12px',
                  fontFamily: 'ui-monospace, monospace',
                  color: '#475569',
                  display: 'block',
                  marginTop: '4px',
                }}
              >
                {(session.totalFileSize / 1024).toFixed(2)} KB ·{' '}
                {session.header.total_chunks} ×{' '}
                {(session.header.chunk_size / 1024).toFixed(0)} KB
              </span>
            </div>

            <div
              style={{
                padding: '14px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                minWidth: 0,
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
                {st.directoryArchTitle}
              </span>
              <span
                className="tabular-nums"
                style={{
                  fontSize: '12px',
                  fontFamily: 'ui-monospace, monospace',
                  color: '#475569',
                  display: 'block',
                  marginTop: '4px',
                }}
              >
                {session.header.is_hierarchical
                  ? st.hierarchicalDesc(session.rootLeaves.length)
                  : st.flatDesc}
              </span>
            </div>

            <div
              style={{
                padding: '14px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                minWidth: 0,
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
                {st.generatorBuildTitle}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontFamily: 'ui-monospace, monospace',
                  color: '#475569',
                  display: 'block',
                  marginTop: '4px',
                  wordBreak: 'break-word',
                }}
              >
                {session.metadata.generator || 'plasmid'} ·{' '}
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
            borderRadius: '8px',
            marginBottom: '14px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <Lock size={16} color="#2563eb" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                {st.privacyTitle}
              </span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#1d4ed8',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '2px 8px',
                borderRadius: '9999px',
                wordBreak: 'break-word',
              }}
            >
              {st.privacyBadge}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
            {st.privacyDesc}
          </p>
          <div
            style={{
              marginTop: '12px',
              padding: '10px 14px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#166534',
              }}
            >
              <CheckCircle2 size={14} color="#16a34a" style={{ flexShrink: 0 }} />
              <span>{st.privacyStatusTitle}</span>
            </span>
            <span
              style={{
                fontSize: '11px',
                color: '#475569',
                display: 'block',
                marginTop: '3px',
              }}
            >
              {st.privacyStatusDesc}
            </span>
          </div>
        </div>

        <div
          style={{
            padding: '16px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
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
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                {st.integrityTitle}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: '#475569',
                  display: 'block',
                  marginTop: '2px',
                }}
              >
                {st.integrityDesc}
              </span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#166534',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '4px 10px',
                borderRadius: '9999px',
                whiteSpace: 'nowrap',
              }}
            >
              {st.airgapBadge}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
