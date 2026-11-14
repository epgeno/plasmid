import { decoderClient } from './decoderClient.js';
import {
  DEFAULT_DATASET_URL,
  DEFAULT_OPFS_FILENAME,
  plasmidContainerClient,
} from './plasmidContainerClient.js';
import type {
  SwarmPeerRole,
  SwarmPeerSummary,
  SwarmSignalMessage,
} from './signalingRelay.js';
import type {
  WasmChunkMerkleBundle,
  WasmHeaderInfo,
  WasmMerkleProofStep,
} from '../types/plasmid';

export type { SwarmPeerRole };

export type PeerConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'banned';

export type SwarmAuditCategory =
  | 'signal'
  | 'webrtc'
  | 'merkle-pass'
  | 'merkle-fail'
  | 'fallback-206'
  | 'privacy-guard';

export interface SwarmAuditEntry {
  id: string;
  timestamp: string;
  category: SwarmAuditCategory;
  message: string;
}

export interface SwarmLivePeer {
  peerId: string;
  role: SwarmPeerRole;
  status: PeerConnectionStatus;
  rttMs: number | null;
  bytesSent: number;
  bytesReceived: number;
  chunksVerified: number;
  chunksRejected: number;
  remoteRootHashHex: string | null;
  availableChunksCount: number;
  banReason: string | null;
}

export interface SwarmSnapshot {
  joined: boolean;
  joining: boolean;
  room: string;
  localPeerId: string;
  role: SwarmPeerRole | null;
  datasetUrl: string;
  header: WasmHeaderInfo | null;
  seederChunksReady: number;
  seederByzantineMode: boolean;
  peers: SwarmLivePeer[];
  p2pBytesSent: number;
  p2pBytesReceived: number;
  chunksSent: number;
  chunksVerified: number;
  chunksRejected: number;
  kAnonymityBlocks: number;
  originFallbackCount: number;
  originFallbackBytes: number;
  lastOriginRange: string | null;
  lastOriginStatus: number | null;
  verifiedChunkIndices: number[];
  logs: SwarmAuditEntry[];
  error: string | null;
}

export interface PieceFrameMeta {
  requestId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkSize: number;
  leafSha256Hex: string;
  rootHashHex: string;
  proof: WasmMerkleProofStep[];
}

export interface BatchTransferResult {
  source: 'webrtc-p2p' | 'origin-http-206-fallback';
  peerId: string;
  bannedPeerId: string | null;
  chunkIndices: number[];
  p2pBytesReceived: number;
  originBytesFetched: number;
  rangeHeaders: string[];
  httpStatuses: number[];
  elapsedMs: number;
}

type DataChannelControlMessage =
  | {
      kind: 'HANDSHAKE';
      peerId: string;
      role: SwarmPeerRole;
      rootHashHex: string;
      chunkSize: number;
      totalChunks: number;
      availableChunksCount: number;
    }
  | {
      kind: 'PING';
      nonce: number;
      sentAtPerfMs: number;
    }
  | {
      kind: 'PONG';
      nonce: number;
      echoSentAtPerfMs: number;
    }
  | {
      kind: 'CHUNK_BATCH_REQ';
      requestId: string;
      chunkIndices: number[];
      simulateByzantine?: boolean;
    }
  | {
      kind: 'BATCH_REJECTED';
      requestId: string;
      code: 'K_ANONYMITY_VIOLATION' | 'UNAVAILABLE';
      message: string;
    };

interface ManagedPeerConnection {
  peerId: string;
  role: SwarmPeerRole;
  status: PeerConnectionStatus;
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
  rxQueue: Promise<void>;
  remoteDescSet: boolean;
  pendingIceCandidates: RTCIceCandidateInit[];
  rttMs: number | null;
  bytesSent: number;
  bytesReceived: number;
  chunksVerified: number;
  chunksRejected: number;
  remoteRootHashHex: string | null;
  availableChunksCount: number;
  banReason: string | null;
}

interface PendingBatchRequest {
  requestId: string;
  peerId: string;
  chunkIndices: number[];
  startedPerfMs: number;
  verifiedChunks: Map<number, Uint8Array>;
  p2pBytesThisBatch: number;
  recoveringViaOrigin: boolean;
  settled: boolean;
  timeoutId: ReturnType<typeof setTimeout>;
  resolve: (res: BatchTransferResult) => void;
  reject: (err: Error) => void;
}

export const MIN_SWARM_BATCH_CHUNKS = 2;
export const DATA_CHANNEL_LABEL = 'plasmid-bep52-v1';
const PIECE_FRAME_MAGIC = new Uint8Array([0x50, 0x4c, 0x50, 0x4b]); // "PLPK"
const SIGNAL_ENDPOINT = '/api/swarm/signal';
const MAX_AUDIT_LOGS = 80;

export function generatePeerId(): string {
  const bytes = new Uint8Array(5);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `peer_${hex}`;
}

export function shouldInitiateWebRtc(
  localPeerId: string,
  localRole: SwarmPeerRole,
  remotePeerId: string,
  remoteRole: SwarmPeerRole
): boolean {
  if (localRole === 'leecher' && remoteRole === 'seeder') return true;
  if (localRole === 'seeder' && remoteRole === 'leecher') return false;
  if (localRole === 'leecher' && remoteRole === 'leecher') return false;
  return localPeerId < remotePeerId;
}

export interface SwarmBatchValidationResult {
  ok: boolean;
  uniqueIndices: number[];
  reason: string;
}

export function validateSwarmBatchPrivacy(
  chunkIndices: number[],
  totalChunks: number
): SwarmBatchValidationResult {
  const unique = [...new Set(chunkIndices.map((n) => Math.trunc(n)))];
  if (unique.length === 0) {
    return {
      ok: false,
      uniqueIndices: [],
      reason: 'Chunk batch request cannot be empty.',
    };
  }
  if (totalChunks > 1 && unique.length < MIN_SWARM_BATCH_CHUNKS) {
    return {
      ok: false,
      uniqueIndices: unique,
      reason: `RFC-0003 K-Anonymity violation: single-chunk P2P query ([${unique.join(', ')}]) rejected. Minimum ${MIN_SWARM_BATCH_CHUNKS} chunks required per batch.`,
    };
  }
  for (const idx of unique) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= totalChunks) {
      return {
        ok: false,
        uniqueIndices: unique,
        reason: `Chunk index #${idx} is out of bounds (0..${Math.max(0, totalChunks - 1)}).`,
      };
    }
  }
  return { ok: true, uniqueIndices: unique, reason: '' };
}

export function packSwarmPieceFrame(
  meta: PieceFrameMeta,
  chunkBytes: Uint8Array
): Uint8Array {
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta));
  const totalLen = 8 + metaBytes.byteLength + chunkBytes.byteLength;
  const out = new Uint8Array(totalLen);
  out.set(PIECE_FRAME_MAGIC, 0);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  view.setUint32(4, metaBytes.byteLength, true);
  out.set(metaBytes, 8);
  out.set(chunkBytes, 8 + metaBytes.byteLength);
  return out;
}

export function unpackSwarmPieceFrame(frameBuffer: ArrayBuffer | Uint8Array): {
  meta: PieceFrameMeta;
  chunkBytes: Uint8Array;
} {
  const raw =
    frameBuffer instanceof Uint8Array ? frameBuffer : new Uint8Array(frameBuffer);
  if (raw.byteLength < 8) {
    throw new Error(`Invalid piece frame: buffer too short (${raw.byteLength} B)`);
  }
  for (let i = 0; i < 4; i++) {
    if (raw[i] !== PIECE_FRAME_MAGIC[i]) {
      throw new Error('Invalid piece frame magic (expected PLPK)');
    }
  }
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const metaLen = view.getUint32(4, true);
  if (metaLen === 0 || 8 + metaLen > raw.byteLength) {
    throw new Error(`Corrupted piece frame metadata length (${metaLen} B)`);
  }
  const metaJson = new TextDecoder('utf-8').decode(raw.subarray(8, 8 + metaLen));
  const meta = JSON.parse(metaJson) as PieceFrameMeta;
  const chunkBytes = raw.slice(8 + metaLen);
  return { meta, chunkBytes };
}

async function computeWebCryptoSha256Hex(bytes: Uint8Array): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return null;
  }
  const cleanCopy = new Uint8Array(bytes.byteLength);
  cleanCopy.set(bytes);
  const digestBuf = await crypto.subtle.digest('SHA-256', cleanCopy);
  return Array.from(new Uint8Array(digestBuf), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

export type SwarmStateListener = (snapshot: SwarmSnapshot) => void;

export class WebRtcSwarmClient {
  private listeners = new Set<SwarmStateListener>();
  private localPeerId: string = generatePeerId();
  private joined = false;
  private joining = false;
  private room = 'clinvar-grch38';
  private role: SwarmPeerRole | null = null;
  private datasetUrl = DEFAULT_DATASET_URL;
  private header: WasmHeaderInfo | null = null;
  private seederPayloadBytes: Uint8Array | null = null;
  private seederProofCache = new Map<number, WasmChunkMerkleBundle>();
  private seederByzantineMode = false;

  private peers = new Map<string, ManagedPeerConnection>();
  private bannedPeerIds = new Set<string>();
  private verifiedChunks = new Map<number, Uint8Array>();
  private pendingBatches = new Map<string, PendingBatchRequest>();

  private lastSignalSeq = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pollingInFlight = false;
  private pingNonce = 0;
  private reqCounter = 0;
  private logCounter = 0;

  private p2pBytesSent = 0;
  private p2pBytesReceived = 0;
  private chunksSent = 0;
  private chunksVerified = 0;
  private chunksRejected = 0;
  private kAnonymityBlocks = 0;
  private originFallbackCount = 0;
  private originFallbackBytes = 0;
  private lastOriginRange: string | null = null;
  private lastOriginStatus: number | null = null;
  private logs: SwarmAuditEntry[] = [];
  private error: string | null = null;

  public subscribe(listener: SwarmStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  private addLog(category: SwarmAuditCategory, message: string): void {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    const entry: SwarmAuditEntry = {
      id: `swlog_${++this.logCounter}`,
      timestamp: `${hh}:${mm}:${ss}.${ms}`,
      category,
      message,
    };
    this.logs = [entry, ...this.logs].slice(0, MAX_AUDIT_LOGS);
    this.emit();
  }

  public getSnapshot(): SwarmSnapshot {
    const peerList: SwarmLivePeer[] = [...this.peers.values()].map((p) => ({
      peerId: p.peerId,
      role: p.role,
      status: p.status,
      rttMs: p.rttMs,
      bytesSent: p.bytesSent,
      bytesReceived: p.bytesReceived,
      chunksVerified: p.chunksVerified,
      chunksRejected: p.chunksRejected,
      remoteRootHashHex: p.remoteRootHashHex,
      availableChunksCount: p.availableChunksCount,
      banReason: p.banReason,
    }));

    return {
      joined: this.joined,
      joining: this.joining,
      room: this.room,
      localPeerId: this.localPeerId,
      role: this.role,
      datasetUrl: this.datasetUrl,
      header: this.header,
      seederChunksReady:
        this.role === 'seeder' && this.seederPayloadBytes && this.header
          ? this.header.total_chunks
          : 0,
      seederByzantineMode: this.seederByzantineMode,
      peers: peerList,
      p2pBytesSent: this.p2pBytesSent,
      p2pBytesReceived: this.p2pBytesReceived,
      chunksSent: this.chunksSent,
      chunksVerified: this.chunksVerified,
      chunksRejected: this.chunksRejected,
      kAnonymityBlocks: this.kAnonymityBlocks,
      originFallbackCount: this.originFallbackCount,
      originFallbackBytes: this.originFallbackBytes,
      lastOriginRange: this.lastOriginRange,
      lastOriginStatus: this.lastOriginStatus,
      verifiedChunkIndices: [...this.verifiedChunks.keys()].sort((a, b) => a - b),
      logs: this.logs,
      error: this.error,
    };
  }

  public setSeederByzantineMode(enabled: boolean): void {
    this.seederByzantineMode = enabled;
    this.addLog(
      'webrtc',
      enabled
        ? 'Seeder Byzantine test mode ARMED: outgoing RTCDataChannel chunk bytes will be mutated on wire'
        : 'Seeder Byzantine test mode disarmed: serving authentic Merkle-verified chunks'
    );
  }

  private async postSignal(body: {
    type: 'announce' | 'offer' | 'answer' | 'ice' | 'leave';
    toPeerId?: string;
    payload?: unknown;
  }): Promise<{ seq: number; peers: SwarmPeerSummary[] }> {
    if (!this.role) {
      throw new Error('Swarm role is not active');
    }
    const res = await fetch(SIGNAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: this.room,
        fromPeerId: this.localPeerId,
        toPeerId: body.toPeerId ?? null,
        role: this.role,
        type: body.type,
        rootHashHex: this.header?.root_hash_hex ?? null,
        totalChunks: this.header?.total_chunks ?? null,
        payload: body.payload ?? null,
      }),
    });

    const data = (await res.json()) as {
      ok?: boolean;
      seq?: number;
      peers?: SwarmPeerSummary[];
      error?: string;
    };

    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Signaling HTTP ${res.status}`);
    }

    return {
      seq: data.seq ?? 0,
      peers: data.peers ?? [],
    };
  }

  public async joinRoom(options: {
    room: string;
    role: SwarmPeerRole;
    datasetUrl?: string;
  }): Promise<void> {
    if (this.joined || this.joining) {
      await this.leaveRoom();
    }

    if (typeof RTCPeerConnection === 'undefined') {
      this.error = 'WebRTC RTCPeerConnection is not supported in this browser runtime.';
      this.emit();
      throw new Error(this.error);
    }

    const cleanRoom = options.room.trim();
    this.joining = true;
    this.error = null;
    this.room = cleanRoom;
    this.role = options.role;
    this.datasetUrl = options.datasetUrl ?? DEFAULT_DATASET_URL;
    this.localPeerId = generatePeerId();
    this.lastSignalSeq = 0;
    this.seederPayloadBytes = null;
    this.seederProofCache.clear();
    this.emit();

    try {
      if (options.role === 'seeder') {
        const seeded = await plasmidContainerClient.loadPublicPayloadForSeeding({
          datasetUrl: this.datasetUrl,
          opfsFilename: DEFAULT_OPFS_FILENAME,
        });
        this.header = seeded.session.header;
        this.seederPayloadBytes = seeded.payloadBytes;
        this.addLog(
          'merkle-pass',
          `Seeder verified ${seeded.verification.total_chunks} × ${(seeded.session.header.chunk_size / 1024).toFixed(0)}KB chunks (${seeded.verification.verified_bytes.toLocaleString()} B) -> root 0x${seeded.session.header.root_hash_hex.slice(0, 16)}…`
        );
      } else {
        const session = await plasmidContainerClient.getSession({
          sourceMode: 'public',
          airgapped: false,
          datasetUrl: this.datasetUrl,
          opfsFilename: DEFAULT_OPFS_FILENAME,
        });
        this.header = session.header;
        this.addLog(
          'signal',
          `Leecher loaded 128B header root 0x${session.header.root_hash_hex.slice(0, 16)}… (${session.header.total_chunks} chunks)`
        );
      }

      const pollSync = await fetch(
        `${SIGNAL_ENDPOINT}?room=${encodeURIComponent(this.room)}&peerId=${encodeURIComponent(this.localPeerId)}&after=0`
      );
      if (pollSync.ok) {
        const syncJson = (await pollSync.json()) as { lastSeq?: number };
        this.lastSignalSeq = syncJson.lastSeq ?? 0;
      }

      const announceRes = await this.postSignal({ type: 'announce' });
      this.lastSignalSeq = Math.max(this.lastSignalSeq, announceRes.seq);
      this.joined = true;
      this.joining = false;

      this.addLog(
        'signal',
        `Joined room "${this.room}" as ${options.role.toUpperCase()} (${this.localPeerId}); ${announceRes.peers.length} peer(s) present`
      );

      this.reconcileRoomPeers(announceRes.peers);
      this.startTimers();
      this.emit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.joining = false;
      this.joined = false;
      this.role = null;
      this.error = msg;
      this.addLog('signal', `Failed to join swarm room "${cleanRoom}": ${msg}`);
      this.emit();
      throw err;
    }
  }

  public async leaveRoom(): Promise<void> {
    this.stopTimers();

    for (const [, req] of this.pendingBatches) {
      clearTimeout(req.timeoutId);
      if (!req.settled) {
        req.settled = true;
        req.reject(new Error('Left WebRTC swarm room'));
      }
    }
    this.pendingBatches.clear();

    for (const [, peer] of this.peers) {
      this.closePeerResources(peer);
    }
    this.peers.clear();
    this.bannedPeerIds.clear();

    if (this.joined && this.role) {
      try {
        await this.postSignal({ type: 'leave' });
      } catch {
        // Best-effort leave notification
      }
    }

    const wasJoined = this.joined;
    const prevRoom = this.room;
    this.joined = false;
    this.joining = false;
    this.role = null;
    this.seederPayloadBytes = null;
    this.seederProofCache.clear();
    this.seederByzantineMode = false;

    if (wasJoined) {
      this.addLog('signal', `Disconnected from swarm room "${prevRoom}"`);
    } else {
      this.emit();
    }
  }

  private startTimers(): void {
    this.stopTimers();
    this.pollTimer = setInterval(() => {
      void this.pollSignaling();
    }, 300);

    this.pingTimer = setInterval(() => {
      this.sendRttPings();
    }, 2500);
  }

  private stopTimers(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private async pollSignaling(): Promise<void> {
    if (!this.joined || !this.role || this.pollingInFlight) return;
    this.pollingInFlight = true;

    try {
      const url = `${SIGNAL_ENDPOINT}?room=${encodeURIComponent(this.room)}&peerId=${encodeURIComponent(this.localPeerId)}&after=${this.lastSignalSeq}&role=${encodeURIComponent(this.role)}`;
      const res = await fetch(url);
      if (!res.ok) return;

      const data = (await res.json()) as {
        ok?: boolean;
        lastSeq?: number;
        messages?: SwarmSignalMessage[];
        peers?: SwarmPeerSummary[];
      };

      if (!data.ok || !this.joined) return;

      if (typeof data.lastSeq === 'number' && data.lastSeq > this.lastSignalSeq) {
        this.lastSignalSeq = data.lastSeq;
      }

      if (Array.isArray(data.messages)) {
        for (const msg of data.messages) {
          await this.handleSignalingMessage(msg);
        }
      }

      if (Array.isArray(data.peers)) {
        this.reconcileRoomPeers(data.peers);
      }
    } catch {
      // Transient network hiccup during polling; retry on next tick
    } finally {
      this.pollingInFlight = false;
    }
  }

  private reconcileRoomPeers(remotePeers: SwarmPeerSummary[]): void {
    if (!this.joined || !this.role) return;

    for (const remote of remotePeers) {
      if (remote.peerId === this.localPeerId) continue;
      if (this.bannedPeerIds.has(remote.peerId)) continue;

      const existing = this.peers.get(remote.peerId);
      if (existing) {
        if (existing.status === 'disconnected') {
          this.peers.delete(remote.peerId);
        } else {
          continue;
        }
      }

      if (
        shouldInitiateWebRtc(
          this.localPeerId,
          this.role,
          remote.peerId,
          remote.role
        )
      ) {
        void this.initiateOfferToPeer(remote.peerId, remote.role);
      }
    }
  }

  private createManagedPeer(
    remotePeerId: string,
    remoteRole: SwarmPeerRole
  ): ManagedPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: [] });
    const managed: ManagedPeerConnection = {
      peerId: remotePeerId,
      role: remoteRole,
      status: 'connecting',
      pc,
      dc: null,
      rxQueue: Promise.resolve(),
      remoteDescSet: false,
      pendingIceCandidates: [],
      rttMs: null,
      bytesSent: 0,
      bytesReceived: 0,
      chunksVerified: 0,
      chunksRejected: 0,
      remoteRootHashHex: null,
      availableChunksCount: 0,
      banReason: null,
    };

    pc.onicecandidate = (ev) => {
      if (!ev.candidate || !this.joined || managed.status === 'banned') return;
      void this.postSignal({
        type: 'ice',
        toPeerId: remotePeerId,
        payload: ev.candidate.toJSON(),
      }).catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (managed.status === 'banned') return;
      const st = pc.connectionState;
      if (st === 'failed' || st === 'closed' || st === 'disconnected') {
        if (managed.status !== 'disconnected') {
          managed.status = 'disconnected';
          this.emit();
        }
      }
    };

    this.peers.set(remotePeerId, managed);
    this.emit();
    return managed;
  }

  private attachDataChannel(managed: ManagedPeerConnection, dc: RTCDataChannel): void {
    dc.binaryType = 'arraybuffer';
    managed.dc = dc;

    dc.onopen = () => {
      if (managed.status === 'banned' || this.bannedPeerIds.has(managed.peerId)) {
        dc.close();
        return;
      }
      managed.status = 'connected';
      this.addLog(
        'webrtc',
        `RTCDataChannel "${dc.label}" OPEN with ${managed.peerId} (${managed.role})`
      );

      if (this.header && this.role) {
        const hs: DataChannelControlMessage = {
          kind: 'HANDSHAKE',
          peerId: this.localPeerId,
          role: this.role,
          rootHashHex: this.header.root_hash_hex,
          chunkSize: this.header.chunk_size,
          totalChunks: this.header.total_chunks,
          availableChunksCount:
            this.role === 'seeder' ? this.header.total_chunks : this.verifiedChunks.size,
        };
        this.sendControlMessage(managed, hs);
      }

      this.sendPingToPeer(managed);
      this.emit();
    };

    dc.onclose = () => {
      if (managed.status !== 'banned') {
        managed.status = 'disconnected';
        this.emit();
      }
    };

    dc.onmessage = (ev: MessageEvent) => {
      if (managed.status === 'banned' || this.bannedPeerIds.has(managed.peerId)) {
        return;
      }
      if (typeof ev.data === 'string') {
        void this.handleDataChannelControlMessage(managed, ev.data);
      } else if (ev.data instanceof ArrayBuffer) {
        const buf = ev.data;
        managed.rxQueue = managed.rxQueue
          .then(() => this.handleIncomingBinaryFrame(managed, buf))
          .catch(() => {});
      } else if (ev.data instanceof Blob) {
        const blob = ev.data;
        managed.rxQueue = managed.rxQueue
          .then(async () => {
            const buf = await blob.arrayBuffer();
            await this.handleIncomingBinaryFrame(managed, buf);
          })
          .catch(() => {});
      }
    };
  }

  private sendControlMessage(
    managed: ManagedPeerConnection,
    msg: DataChannelControlMessage
  ): void {
    if (!managed.dc || managed.dc.readyState !== 'open') return;
    managed.dc.send(JSON.stringify(msg));
  }

  private sendPingToPeer(managed: ManagedPeerConnection): void {
    if (managed.status !== 'connected' || !managed.dc || managed.dc.readyState !== 'open') {
      return;
    }
    this.sendControlMessage(managed, {
      kind: 'PING',
      nonce: ++this.pingNonce,
      sentAtPerfMs: performance.now(),
    });
  }

  private sendRttPings(): void {
    for (const peer of this.peers.values()) {
      this.sendPingToPeer(peer);
    }
  }

  private async initiateOfferToPeer(
    remotePeerId: string,
    remoteRole: SwarmPeerRole
  ): Promise<void> {
    if (this.bannedPeerIds.has(remotePeerId) || this.peers.has(remotePeerId)) {
      return;
    }

    const managed = this.createManagedPeer(remotePeerId, remoteRole);
    try {
      const dc = managed.pc!.createDataChannel(DATA_CHANNEL_LABEL, { ordered: true });
      this.attachDataChannel(managed, dc);

      const offer = await managed.pc!.createOffer();
      await managed.pc!.setLocalDescription(offer);

      await this.postSignal({
        type: 'offer',
        toPeerId: remotePeerId,
        payload: offer,
      });

      this.addLog('signal', `Sent SDP Offer -> ${remotePeerId} (${remoteRole})`);
    } catch (err: unknown) {
      this.closePeerResources(managed);
      this.peers.delete(remotePeerId);
      this.addLog(
        'signal',
        `Offer negotiation error with ${remotePeerId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async handleSignalingMessage(msg: SwarmSignalMessage): Promise<void> {
    if (msg.fromPeerId === this.localPeerId) return;
    if (this.bannedPeerIds.has(msg.fromPeerId)) return;

    if (msg.type === 'leave') {
      const existing = this.peers.get(msg.fromPeerId);
      if (existing && existing.status !== 'banned') {
        this.closePeerResources(existing);
        this.peers.delete(msg.fromPeerId);
        this.addLog('signal', `Peer ${msg.fromPeerId} left swarm room`);
      }
      return;
    }

    if (msg.type === 'announce') {
      if (
        this.role &&
        !this.peers.has(msg.fromPeerId) &&
        shouldInitiateWebRtc(this.localPeerId, this.role, msg.fromPeerId, msg.role)
      ) {
        await this.initiateOfferToPeer(msg.fromPeerId, msg.role);
      }
      return;
    }

    if (msg.type === 'offer') {
      const existing = this.peers.get(msg.fromPeerId);
      if (existing && existing.status === 'banned') return;
      if (existing) {
        this.closePeerResources(existing);
        this.peers.delete(msg.fromPeerId);
      }

      const managed = this.createManagedPeer(msg.fromPeerId, msg.role);
      managed.pc!.ondatachannel = (ev) => {
        this.attachDataChannel(managed, ev.channel);
      };

      try {
        await managed.pc!.setRemoteDescription(
          msg.payload as RTCSessionDescriptionInit
        );
        managed.remoteDescSet = true;
        await this.flushPendingIce(managed);

        const answer = await managed.pc!.createAnswer();
        await managed.pc!.setLocalDescription(answer);

        await this.postSignal({
          type: 'answer',
          toPeerId: msg.fromPeerId,
          payload: answer,
        });

        this.addLog('signal', `Accepted SDP Offer & sent Answer -> ${msg.fromPeerId}`);
      } catch (err: unknown) {
        this.closePeerResources(managed);
        this.peers.delete(msg.fromPeerId);
        this.addLog(
          'signal',
          `Answer negotiation error with ${msg.fromPeerId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      return;
    }

    if (msg.type === 'answer') {
      const managed = this.peers.get(msg.fromPeerId);
      if (!managed || !managed.pc || managed.status === 'banned') return;
      if (managed.pc.signalingState !== 'have-local-offer') return;

      try {
        await managed.pc.setRemoteDescription(
          msg.payload as RTCSessionDescriptionInit
        );
        managed.remoteDescSet = true;
        await this.flushPendingIce(managed);
        this.addLog('signal', `Received SDP Answer <- ${msg.fromPeerId}`);
      } catch (err: unknown) {
        this.addLog(
          'signal',
          `Failed applying SDP Answer from ${msg.fromPeerId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      return;
    }

    if (msg.type === 'ice') {
      const managed = this.peers.get(msg.fromPeerId);
      if (!managed || !managed.pc || managed.status === 'banned') return;
      const candidate = msg.payload as RTCIceCandidateInit | null;
      if (!candidate) return;

      if (!managed.remoteDescSet) {
        managed.pendingIceCandidates.push(candidate);
      } else {
        try {
          await managed.pc.addIceCandidate(candidate);
        } catch {
          // Ignore redundant/late ICE candidates
        }
      }
    }
  }

  private async flushPendingIce(managed: ManagedPeerConnection): Promise<void> {
    if (!managed.pc || !managed.remoteDescSet) return;
    const queued = managed.pendingIceCandidates.splice(0);
    for (const cand of queued) {
      try {
        await managed.pc.addIceCandidate(cand);
      } catch {
        // Ignore non-fatal candidate errors
      }
    }
  }

  private async handleDataChannelControlMessage(
    managed: ManagedPeerConnection,
    rawJson: string
  ): Promise<void> {
    let msg: DataChannelControlMessage;
    try {
      msg = JSON.parse(rawJson) as DataChannelControlMessage;
    } catch {
      return;
    }

    if (msg.kind === 'PING') {
      this.sendControlMessage(managed, {
        kind: 'PONG',
        nonce: msg.nonce,
        echoSentAtPerfMs: msg.sentAtPerfMs,
      });
      return;
    }

    if (msg.kind === 'PONG') {
      const elapsed = Math.max(0.1, performance.now() - msg.echoSentAtPerfMs);
      managed.rttMs = Math.round(elapsed * 10) / 10;
      this.emit();
      return;
    }

    if (msg.kind === 'HANDSHAKE') {
      managed.remoteRootHashHex = msg.rootHashHex;
      managed.availableChunksCount = msg.availableChunksCount;

      if (
        this.header &&
        msg.rootHashHex.toLowerCase() !== this.header.root_hash_hex.toLowerCase()
      ) {
        this.banPeer(
          managed,
          `Container Merkle root mismatch in handshake (peer=0x${msg.rootHashHex.slice(0, 12)}…, expected=0x${this.header.root_hash_hex.slice(0, 12)}…)`
        );
        return;
      }

      this.addLog(
        'webrtc',
        `Handshake verified with ${managed.peerId} (root 0x${msg.rootHashHex.slice(0, 12)}…, ${msg.availableChunksCount}/${msg.totalChunks} chunks)`
      );
      return;
    }

    if (msg.kind === 'BATCH_REJECTED') {
      this.kAnonymityBlocks += 1;
      this.addLog('privacy-guard', `Peer ${managed.peerId} rejected request: ${msg.message}`);
      const pending = this.pendingBatches.get(msg.requestId);
      if (pending && !pending.settled) {
        pending.settled = true;
        clearTimeout(pending.timeoutId);
        this.pendingBatches.delete(msg.requestId);
        pending.reject(new Error(msg.message));
      }
      this.emit();
      return;
    }

    if (msg.kind === 'CHUNK_BATCH_REQ') {
      await this.serveSeederChunkBatch(managed, msg);
    }
  }

  private async serveSeederChunkBatch(
    managed: ManagedPeerConnection,
    req: Extract<DataChannelControlMessage, { kind: 'CHUNK_BATCH_REQ' }>
  ): Promise<void> {
    if (!this.header || !this.seederPayloadBytes || this.role !== 'seeder') {
      this.sendControlMessage(managed, {
        kind: 'BATCH_REJECTED',
        requestId: req.requestId,
        code: 'UNAVAILABLE',
        message: 'Peer is not an active Seeder with verified payload.',
      });
      return;
    }

    const privacyCheck = validateSwarmBatchPrivacy(
      req.chunkIndices,
      this.header.total_chunks
    );
    if (!privacyCheck.ok) {
      this.kAnonymityBlocks += 1;
      this.sendControlMessage(managed, {
        kind: 'BATCH_REJECTED',
        requestId: req.requestId,
        code: 'K_ANONYMITY_VIOLATION',
        message: privacyCheck.reason,
      });
      this.addLog('privacy-guard', `Blocked request from ${managed.peerId}: ${privacyCheck.reason}`);
      return;
    }

    const uncachedIndices = privacyCheck.uniqueIndices.filter(
      (idx) => !this.seederProofCache.has(idx)
    );
    if (uncachedIndices.length > 0) {
      const bundles = await decoderClient.generateChunkProofs(
        this.seederPayloadBytes,
        this.header.chunk_size,
        uncachedIndices
      );
      for (const b of bundles) {
        this.seederProofCache.set(b.chunk_index, b);
      }
    }

    const injectCorruption = Boolean(this.seederByzantineMode || req.simulateByzantine);
    const chunkSize = this.header.chunk_size;

    for (let i = 0; i < privacyCheck.uniqueIndices.length; i++) {
      if (!managed.dc || managed.dc.readyState !== 'open') break;
      const chunkIdx = privacyCheck.uniqueIndices[i];
      const bundle = this.seederProofCache.get(chunkIdx);
      if (!bundle) continue;

      const start = chunkIdx * chunkSize;
      const cleanSlice = this.seederPayloadBytes.subarray(start, start + chunkSize);
      let wireChunkBytes = cleanSlice;

      // Corrupt outgoing wire bytes on the first chunk when Byzantine fault mode is active
      if (injectCorruption && i === 0) {
        const mutated = new Uint8Array(cleanSlice);
        mutated[0] ^= 0xff;
        mutated[1] ^= 0x5a;
        mutated[2] ^= 0xa5;
        mutated[3] ^= 0xff;
        wireChunkBytes = mutated;
        this.addLog(
          'merkle-fail',
          `[Seeder Byzantine Wire Injection] Transmitted mutated 16KB payload for chunk #${chunkIdx} over RTCDataChannel -> ${managed.peerId}`
        );
      }

      const frame = packSwarmPieceFrame(
        {
          requestId: req.requestId,
          chunkIndex: chunkIdx,
          totalChunks: this.header.total_chunks,
          chunkSize,
          leafSha256Hex: bundle.leaf_sha256_hex,
          rootHashHex: bundle.root_hash_hex,
          proof: bundle.proof,
        },
        wireChunkBytes
      );

      const exactArrayBuffer = frame.buffer.slice(
        frame.byteOffset,
        frame.byteOffset + frame.byteLength
      ) as ArrayBuffer;
      managed.dc.send(exactArrayBuffer);
      managed.bytesSent += wireChunkBytes.byteLength;
      this.p2pBytesSent += wireChunkBytes.byteLength;
      this.chunksSent += 1;
    }

    if (!injectCorruption) {
      this.addLog(
        'webrtc',
        `Served ${privacyCheck.uniqueIndices.length} × 16KB Merkle chunk(s) [#${privacyCheck.uniqueIndices.join(', #')}] -> ${managed.peerId}`
      );
    } else {
      this.emit();
    }
  }

  private banPeer(managed: ManagedPeerConnection, reason: string): void {
    this.bannedPeerIds.add(managed.peerId);
    managed.status = 'banned';
    managed.banReason = reason;
    this.closePeerResources(managed);
    this.addLog('merkle-fail', `BANNED peer ${managed.peerId}: ${reason}`);
  }

  private closePeerResources(managed: ManagedPeerConnection): void {
    try {
      if (managed.dc) {
        managed.dc.onmessage = null;
        managed.dc.onopen = null;
        managed.dc.onclose = null;
        managed.dc.close();
      }
    } catch {
      // Ignore close errors
    }
    try {
      if (managed.pc) {
        managed.pc.onicecandidate = null;
        managed.pc.ondatachannel = null;
        managed.pc.onconnectionstatechange = null;
        managed.pc.close();
      }
    } catch {
      // Ignore close errors
    }
    managed.dc = null;
    managed.pc = null;
  }

  private async handleIncomingBinaryFrame(
    managed: ManagedPeerConnection,
    rawBuffer: ArrayBuffer
  ): Promise<void> {
    if (!this.header || managed.status === 'banned' || this.bannedPeerIds.has(managed.peerId)) {
      return;
    }

    let unpacked: { meta: PieceFrameMeta; chunkBytes: Uint8Array };
    try {
      unpacked = unpackSwarmPieceFrame(rawBuffer);
    } catch (err: unknown) {
      this.chunksRejected += 1;
      managed.chunksRejected += 1;
      this.banPeer(
        managed,
        `Malformed binary piece frame (${err instanceof Error ? err.message : String(err)})`
      );
      return;
    }

    const { meta, chunkBytes } = unpacked;
    managed.bytesReceived += chunkBytes.byteLength;
    this.p2pBytesReceived += chunkBytes.byteLength;

    const [wasmCheck, webCryptoHex] = await Promise.all([
      decoderClient.verifyMerkleChunkProof({
        chunkBuffer: chunkBytes,
        chunkIndex: meta.chunkIndex,
        totalChunks: this.header.total_chunks,
        chunkSize: this.header.chunk_size,
        expectedRootHex: this.header.root_hash_hex,
        proof: meta.proof,
      }),
      computeWebCryptoSha256Hex(chunkBytes),
    ]);

    const webCryptoMatches =
      webCryptoHex === null ||
      webCryptoHex.toLowerCase() === wasmCheck.leaf_sha256_hex.toLowerCase();

    if (!wasmCheck.verified || !webCryptoMatches) {
      this.chunksRejected += 1;
      managed.chunksRejected += 1;

      const reason = `SHA-256 BEP 52 Merkle mismatch on chunk #${meta.chunkIndex} (leaf 0x${wasmCheck.leaf_sha256_hex.slice(0, 14)}… != 0x${meta.leafSha256Hex.slice(0, 14)}…, root 0x${wasmCheck.calculated_root_hex.slice(0, 14) || 'invalid'}… != header 0x${this.header.root_hash_hex.slice(0, 14)}…)`;
      this.banPeer(managed, reason);

      const pending = this.pendingBatches.get(meta.requestId);
      if (pending && !pending.settled && !pending.recoveringViaOrigin) {
        pending.recoveringViaOrigin = true;
        await this.recoverBatchViaOriginHttp206(pending, managed.peerId, meta.proof, meta.chunkIndex);
      }
      return;
    }

    // Cryptographic verification PASSED!
    this.chunksVerified += 1;
    managed.chunksVerified += 1;
    this.verifiedChunks.set(meta.chunkIndex, chunkBytes);
    plasmidContainerClient.injectVerifiedSwarmChunk(
      this.datasetUrl,
      meta.chunkIndex,
      chunkBytes
    );

    this.addLog(
      'merkle-pass',
      `Verified P2P chunk #${meta.chunkIndex} (${chunkBytes.byteLength.toLocaleString()} B) from ${managed.peerId} -> SHA-256 0x${wasmCheck.leaf_sha256_hex.slice(0, 16)}… (Merkle root matched)`
    );

    const pending = this.pendingBatches.get(meta.requestId);
    if (pending && !pending.settled && !pending.recoveringViaOrigin) {
      pending.verifiedChunks.set(meta.chunkIndex, chunkBytes);
      pending.p2pBytesThisBatch += chunkBytes.byteLength;

      if (pending.verifiedChunks.size >= pending.chunkIndices.length) {
        pending.settled = true;
        clearTimeout(pending.timeoutId);
        this.pendingBatches.delete(meta.requestId);
        pending.resolve({
          source: 'webrtc-p2p',
          peerId: managed.peerId,
          bannedPeerId: null,
          chunkIndices: pending.chunkIndices,
          p2pBytesReceived: pending.p2pBytesThisBatch,
          originBytesFetched: 0,
          rangeHeaders: [],
          httpStatuses: [],
          elapsedMs: Math.round((performance.now() - pending.startedPerfMs) * 10) / 10,
        });
      }
    }
  }

  private async recoverBatchViaOriginHttp206(
    pending: PendingBatchRequest,
    bannedPeerId: string,
    failedChunkProof: WasmMerkleProofStep[],
    failedChunkIndex: number
  ): Promise<void> {
    if (!this.header) return;

    const missingIndices = pending.chunkIndices.filter(
      (idx) => !pending.verifiedChunks.has(idx)
    );

    try {
      const originRes = await plasmidContainerClient.fetchOriginChunksHttp206({
        datasetUrl: this.datasetUrl,
        header: this.header,
        chunkIndices: missingIndices,
      });

      // Also verify the recovered chunk against the 128B header's BEP 52 Merkle root when sibling path is present
      const recoveredFailed = originRes.chunks.get(failedChunkIndex);
      if (recoveredFailed && failedChunkProof.length > 0) {
        const proofCheck = await decoderClient.verifyMerkleChunkProof({
          chunkBuffer: recoveredFailed.bytes,
          chunkIndex: failedChunkIndex,
          totalChunks: this.header.total_chunks,
          chunkSize: this.header.chunk_size,
          expectedRootHex: this.header.root_hash_hex,
          proof: failedChunkProof,
        });
        if (!proofCheck.verified) {
          throw new Error(
            `Origin chunk #${failedChunkIndex} failed BEP 52 Merkle verification against header root`
          );
        }
      }

      for (const [chunkIdx, entry] of originRes.chunks.entries()) {
        this.verifiedChunks.set(chunkIdx, entry.bytes);
        pending.verifiedChunks.set(chunkIdx, entry.bytes);
        this.chunksVerified += 1;
      }

      this.originFallbackCount += 1;
      this.originFallbackBytes += originRes.bytesFetched;
      this.lastOriginRange = originRes.rangeHeaders.join(', ');
      this.lastOriginStatus = originRes.httpStatuses[0] ?? 206;

      this.addLog(
        'fallback-206',
        `HTTP ${this.lastOriginStatus} Origin Fallback [${this.lastOriginRange}] recovered ${missingIndices.length} chunk(s) (${originRes.bytesFetched.toLocaleString()} B) & SHA-256 verified after banning ${bannedPeerId}`
      );

      if (!pending.settled) {
        pending.settled = true;
        clearTimeout(pending.timeoutId);
        this.pendingBatches.delete(pending.requestId);
        pending.resolve({
          source: 'origin-http-206-fallback',
          peerId: bannedPeerId,
          bannedPeerId,
          chunkIndices: pending.chunkIndices,
          p2pBytesReceived: pending.p2pBytesThisBatch,
          originBytesFetched: originRes.bytesFetched,
          rangeHeaders: originRes.rangeHeaders,
          httpStatuses: originRes.httpStatuses,
          elapsedMs: Math.round((performance.now() - pending.startedPerfMs) * 10) / 10,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.error = msg;
      this.addLog('fallback-206', `Origin HTTP 206 fallback failed: ${msg}`);
      if (!pending.settled) {
        pending.settled = true;
        clearTimeout(pending.timeoutId);
        this.pendingBatches.delete(pending.requestId);
        pending.reject(err instanceof Error ? err : new Error(msg));
      }
    }
  }

  private selectBestConnectedSeeder(): ManagedPeerConnection | null {
    const candidates = [...this.peers.values()].filter(
      (p) =>
        p.status === 'connected' &&
        p.role === 'seeder' &&
        p.dc?.readyState === 'open' &&
        !this.bannedPeerIds.has(p.peerId)
    );
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (a.rttMs ?? 9999) - (b.rttMs ?? 9999));
    return candidates[0];
  }

  /**
   * Requests a K-anonymous batch (>= 2 chunks) of 16KB .plasmid Merkle leaves over a live
   * WebRTC RTCDataChannel from the lowest-RTT connected Seeder.
   */
  public async requestChunkBatch(
    chunkIndices: number[],
    options?: {
      simulateByzantine?: boolean;
      rawSingleChunkProbe?: boolean;
      timeoutMs?: number;
    }
  ): Promise<BatchTransferResult> {
    this.error = null;
    if (!this.joined || !this.header) {
      throw new Error('Join a swarm room before requesting P2P chunks.');
    }

    if (!options?.rawSingleChunkProbe) {
      const check = validateSwarmBatchPrivacy(chunkIndices, this.header.total_chunks);
      if (!check.ok) {
        this.kAnonymityBlocks += 1;
        this.error = check.reason;
        this.addLog('privacy-guard', check.reason);
        throw new Error(check.reason);
      }
      chunkIndices = check.uniqueIndices;
    }

    const bestSeeder = this.selectBestConnectedSeeder();
    if (!bestSeeder) {
      const msg = 'No active non-banned WebRTC Seeder peer is connected in this room.';
      this.error = msg;
      this.emit();
      throw new Error(msg);
    }

    const requestId = `batch_${this.localPeerId}_${++this.reqCounter}`;
    const timeoutMs = options?.timeoutMs ?? 12_000;

    return new Promise<BatchTransferResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const pending = this.pendingBatches.get(requestId);
        if (pending && !pending.settled) {
          pending.settled = true;
          this.pendingBatches.delete(requestId);
          const err = new Error(
            `Timed out waiting for P2P chunk batch [${chunkIndices.join(', ')}] from ${bestSeeder.peerId}`
          );
          this.error = err.message;
          this.emit();
          reject(err);
        }
      }, timeoutMs);

      const pending: PendingBatchRequest = {
        requestId,
        peerId: bestSeeder.peerId,
        chunkIndices: [...chunkIndices],
        startedPerfMs: performance.now(),
        verifiedChunks: new Map(),
        p2pBytesThisBatch: 0,
        recoveringViaOrigin: false,
        settled: false,
        timeoutId,
        resolve,
        reject,
      };

      this.pendingBatches.set(requestId, pending);

      this.addLog(
        'webrtc',
        options?.simulateByzantine
          ? `Requested chunks [#${chunkIndices.join(', #')}] from ${bestSeeder.peerId} with Byzantine wire tamper test`
          : `Requested ${chunkIndices.length} chunk(s) [#${chunkIndices.join(', #')}] (${(chunkIndices.length * 16).toLocaleString()} KB) over RTCDataChannel -> ${bestSeeder.peerId}`
      );

      this.sendControlMessage(bestSeeder, {
        kind: 'CHUNK_BATCH_REQ',
        requestId,
        chunkIndices,
        simulateByzantine: options?.simulateByzantine,
      });
    });
  }
}

export const webRtcSwarmClient = new WebRtcSwarmClient();
