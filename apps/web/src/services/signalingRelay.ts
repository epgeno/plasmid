/**
 * Ephemeral WebRTC P2P Swarm Signaling Relay (/api/swarm/signal)
 *
 * Enforces Plasmid RFC-0002 (zero raw user genomic payloads) and RFC-0003
 * (prohibits proprietary OMIM/COSMIC/HGMD/SNPedia rooms) while relaying
 * bounded SDP Offer/Answer, Trickle ICE candidates, and room peer presence.
 */

export type SwarmPeerRole = 'seeder' | 'leecher';
export type SwarmSignalType = 'announce' | 'offer' | 'answer' | 'ice' | 'leave';

export interface SwarmPeerSummary {
  peerId: string;
  role: SwarmPeerRole;
  rootHashHex: string | null;
  totalChunks: number | null;
  updatedAt: number;
}

export interface SwarmSignalMessage {
  seq: number;
  room: string;
  fromPeerId: string;
  toPeerId: string | null;
  role: SwarmPeerRole;
  type: SwarmSignalType;
  rootHashHex: string | null;
  totalChunks: number | null;
  payload: unknown;
  createdAt: number;
}

export interface SwarmSignalPostBody {
  room?: unknown;
  fromPeerId?: unknown;
  toPeerId?: unknown;
  role?: unknown;
  type?: unknown;
  rootHashHex?: unknown;
  totalChunks?: unknown;
  payload?: unknown;
}

interface RoomState {
  room: string;
  lastSeq: number;
  updatedAt: number;
  peers: Map<string, SwarmPeerSummary>;
  messages: SwarmSignalMessage[];
}

export const MAX_SIGNAL_BODY_BYTES = 32_768;
export const SWARM_PEER_TTL_MS = 45_000;
export const SWARM_MESSAGE_TTL_MS = 60_000;
export const MAX_SWARM_ROOMS = 128;
export const MAX_PEERS_PER_ROOM = 32;
export const MAX_MESSAGES_PER_ROOM = 256;

const ROOM_NAME_RE = /^[a-zA-Z0-9._:-]{3,64}$/;
const PEER_ID_RE = /^[a-zA-Z0-9_-]{4,64}$/;
const HEX_64_RE = /^[0-9a-fA-F]{64}$/;
const PROPRIETARY_ROOM_TOKENS = ['omim', 'cosmic', 'hgmd', 'snpedia'];
const RAW_GENOME_LEAK_RE =
  /##fileformat=VCF|#CHROM(?:\\t|\t)POS|#\s*rsid(?:\\t|\t)chromosome/i;
const DECODED_GENOME_LEAK_RE =
  /##fileformat=VCF|#CHROM\tPOS|#\s*rsid\tchromosome|(?:^|\r?\n)(?:chr)?(?:[1-9]|1\d|2[0-2]|X|Y|M|MT)\t\d+\t[^\t\r\n]+\t[ACGTN]+\t|(?:^|\r?\n)(?:rs|i)\d+\t(?:[1-9]|1\d|2[0-2]|X|Y|MT)\t\d+\t[ACGTDI-]{1,2}(?:\r?\n|$)/i;

function containsDecodedGenomeLeak(val: unknown, depth = 0): boolean {
  if (depth > 8 || val === null || val === undefined) return false;
  if (typeof val === 'string') {
    return DECODED_GENOME_LEAK_RE.test(val);
  }
  if (Array.isArray(val)) {
    return val.some((item) => containsDecodedGenomeLeak(item, depth + 1));
  }
  if (typeof val === 'object') {
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (DECODED_GENOME_LEAK_RE.test(k) || containsDecodedGenomeLeak(v, depth + 1)) {
        return true;
      }
    }
  }
  return false;
}

function normalizeAndValidateSignalPayload(
  signalType: SwarmSignalType,
  rawPayload: unknown
): { ok: boolean; sanitized: unknown; error: string } {
  if (signalType === 'announce' || signalType === 'leave') {
    if (rawPayload !== undefined && rawPayload !== null) {
      return {
        ok: false,
        sanitized: null,
        error: `Signal type "${signalType}" must not include an arbitrary payload`,
      };
    }
    return { ok: true, sanitized: null, error: '' };
  }

  if (signalType === 'offer' || signalType === 'answer') {
    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
      return {
        ok: false,
        sanitized: null,
        error: `Signal type "${signalType}" requires an SDP payload object`,
      };
    }
    const rec = rawPayload as Record<string, unknown>;
    if (rec.type !== signalType || typeof rec.sdp !== 'string' || !rec.sdp.startsWith('v=0')) {
      return {
        ok: false,
        sanitized: null,
        error: `Invalid WebRTC SDP ${signalType} payload (expected { type: "${signalType}", sdp: "v=0..." })`,
      };
    }
    return { ok: true, sanitized: { type: signalType, sdp: rec.sdp }, error: '' };
  }

  // signalType === 'ice'
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return {
      ok: false,
      sanitized: null,
      error: 'Signal type "ice" requires an RTCIceCandidateInit object',
    };
  }
  const ice = rawPayload as Record<string, unknown>;
  if (typeof ice.candidate !== 'string') {
    return {
      ok: false,
      sanitized: null,
      error: 'Invalid ICE candidate payload (missing candidate string)',
    };
  }
  return {
    ok: true,
    sanitized: {
      candidate: ice.candidate,
      sdpMid: typeof ice.sdpMid === 'string' ? ice.sdpMid : null,
      sdpMLineIndex: typeof ice.sdpMLineIndex === 'number' ? ice.sdpMLineIndex : null,
      usernameFragment:
        typeof ice.usernameFragment === 'string' ? ice.usernameFragment : null,
    },
    error: '',
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type',
    },
  });
}

function isValidRole(val: unknown): val is SwarmPeerRole {
  return val === 'seeder' || val === 'leecher';
}

function isValidSignalType(val: unknown): val is SwarmSignalType {
  return (
    val === 'announce' ||
    val === 'offer' ||
    val === 'answer' ||
    val === 'ice' ||
    val === 'leave'
  );
}

function containsProprietaryToken(room: string): string | null {
  const lower = room.toLowerCase();
  for (const token of PROPRIETARY_ROOM_TOKENS) {
    if (lower.includes(token)) {
      return token;
    }
  }
  return null;
}

export class SwarmSignalingRelay {
  private rooms = new Map<string, RoomState>();
  private nowFn: () => number;

  public constructor(nowFn: () => number = () => Date.now()) {
    this.nowFn = nowFn;
  }

  public reset(): void {
    this.rooms.clear();
  }

  private prune(now: number): void {
    for (const [roomName, state] of this.rooms.entries()) {
      for (const [pid, peer] of state.peers.entries()) {
        if (now - peer.updatedAt > SWARM_PEER_TTL_MS) {
          state.peers.delete(pid);
        }
      }
      state.messages = state.messages.filter(
        (msg) => now - msg.createdAt <= SWARM_MESSAGE_TTL_MS
      );
      if (state.peers.size === 0 && state.messages.length === 0 && now - state.updatedAt > SWARM_MESSAGE_TTL_MS) {
        this.rooms.delete(roomName);
      }
    }

    if (this.rooms.size > MAX_SWARM_ROOMS) {
      const sorted = [...this.rooms.entries()].sort(
        (a, b) => a[1].updatedAt - b[1].updatedAt
      );
      while (this.rooms.size > MAX_SWARM_ROOMS && sorted.length > 0) {
        const oldest = sorted.shift();
        if (oldest) {
          this.rooms.delete(oldest[0]);
        }
      }
    }
  }

  private listOtherPeers(state: RoomState | undefined, excludePeerId: string): SwarmPeerSummary[] {
    if (!state) return [];
    const list: SwarmPeerSummary[] = [];
    for (const peer of state.peers.values()) {
      if (peer.peerId !== excludePeerId) {
        list.push({ ...peer });
      }
    }
    return list;
  }

  public async handleRequest(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'Content-Type',
          'access-control-max-age': '86400',
        },
      });
    }

    const now = this.nowFn();
    this.prune(now);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const room = (url.searchParams.get('room') ?? '').trim();
      const peerId = (url.searchParams.get('peerId') ?? '').trim();
      const afterRaw = url.searchParams.get('after');
      const roleParam = url.searchParams.get('role');

      if (!ROOM_NAME_RE.test(room)) {
        return jsonResponse(
          { error: 'Invalid room identifier (3-64 alphanumeric/._:- chars required)' },
          400
        );
      }
      const badToken = containsProprietaryToken(room);
      if (badToken) {
        return jsonResponse(
          {
            error: `RFC-0003 Data Governance violation: proprietary dataset "${badToken}" cannot be swarmed`,
          },
          403
        );
      }
      if (!PEER_ID_RE.test(peerId)) {
        return jsonResponse(
          { error: 'Invalid peerId identifier (4-64 alphanumeric/_- chars required)' },
          400
        );
      }

      const afterParsed = afterRaw !== null ? Number(afterRaw) : 0;
      const after = Number.isFinite(afterParsed) && afterParsed >= 0 ? Math.floor(afterParsed) : 0;

      const state = this.rooms.get(room);
      if (state) {
        const existingPeer = state.peers.get(peerId);
        if (existingPeer) {
          existingPeer.updatedAt = now;
          state.updatedAt = now;
        } else if (isValidRole(roleParam) && state.peers.size < MAX_PEERS_PER_ROOM) {
          state.peers.set(peerId, {
            peerId,
            role: roleParam,
            rootHashHex: null,
            totalChunks: null,
            updatedAt: now,
          });
          state.updatedAt = now;
        }
      }

      const messages = state
        ? state.messages.filter(
            (m) =>
              m.seq > after &&
              m.fromPeerId !== peerId &&
              (m.toPeerId === null || m.toPeerId === peerId)
          )
        : [];

      return jsonResponse({
        ok: true,
        room,
        lastSeq: state?.lastSeq ?? 0,
        messages,
        peers: this.listOtherPeers(state, peerId),
        serverTime: now,
      });
    }

    if (request.method === 'POST') {
      const contentLenHeader = request.headers.get('content-length');
      if (contentLenHeader && Number(contentLenHeader) > MAX_SIGNAL_BODY_BYTES) {
        return jsonResponse(
          { error: `Signaling payload exceeds ${MAX_SIGNAL_BODY_BYTES} byte limit` },
          413
        );
      }

      const rawText = await request.text();
      if (new TextEncoder().encode(rawText).byteLength > MAX_SIGNAL_BODY_BYTES) {
        return jsonResponse(
          { error: `Signaling payload exceeds ${MAX_SIGNAL_BODY_BYTES} byte limit` },
          413
        );
      }

      if (RAW_GENOME_LEAK_RE.test(rawText)) {
        return jsonResponse(
          {
            error:
              'RFC-0002 Air-Gap violation: raw VCF/genomic records are strictly prohibited on signaling endpoints',
          },
          400
        );
      }

      let body: SwarmSignalPostBody;
      try {
        body = JSON.parse(rawText) as SwarmSignalPostBody;
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
      }

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return jsonResponse({ error: 'Invalid JSON signaling envelope' }, 400);
      }

      if (containsDecodedGenomeLeak(body)) {
        return jsonResponse(
          {
            error:
              'RFC-0002 Air-Gap violation: raw VCF/23andMe genomic records are strictly prohibited on signaling endpoints',
          },
          400
        );
      }

      const room = typeof body.room === 'string' ? body.room.trim() : '';
      const fromPeerId =
        typeof body.fromPeerId === 'string' ? body.fromPeerId.trim() : '';
      const toPeerIdRaw =
        typeof body.toPeerId === 'string' && body.toPeerId.trim().length > 0
          ? body.toPeerId.trim()
          : null;

      if (!ROOM_NAME_RE.test(room)) {
        return jsonResponse(
          { error: 'Invalid room identifier (3-64 alphanumeric/._:- chars required)' },
          400
        );
      }
      const badToken = containsProprietaryToken(room);
      if (badToken) {
        return jsonResponse(
          {
            error: `RFC-0003 Data Governance violation: proprietary dataset "${badToken}" cannot be swarmed`,
          },
          403
        );
      }
      if (!PEER_ID_RE.test(fromPeerId)) {
        return jsonResponse(
          { error: 'Invalid fromPeerId identifier (4-64 alphanumeric/_- chars required)' },
          400
        );
      }
      if (toPeerIdRaw !== null && !PEER_ID_RE.test(toPeerIdRaw)) {
        return jsonResponse({ error: 'Invalid toPeerId identifier' }, 400);
      }
      if (!isValidRole(body.role)) {
        return jsonResponse({ error: 'Invalid role: expected "seeder" or "leecher"' }, 400);
      }
      if (!isValidSignalType(body.type)) {
        return jsonResponse(
          { error: 'Invalid signal type: expected announce, offer, answer, ice, or leave' },
          400
        );
      }
      if (
        (body.type === 'offer' || body.type === 'answer' || body.type === 'ice') &&
        !toPeerIdRaw
      ) {
        return jsonResponse(
          { error: `Signal type "${body.type}" requires a target toPeerId` },
          400
        );
      }

      const payloadCheck = normalizeAndValidateSignalPayload(body.type, body.payload);
      if (!payloadCheck.ok) {
        return jsonResponse({ error: payloadCheck.error }, 400);
      }

      const cleanRootHex =
        typeof body.rootHashHex === 'string' &&
        HEX_64_RE.test(body.rootHashHex.trim().replace(/^0x/i, ''))
          ? body.rootHashHex.trim().replace(/^0x/i, '').toLowerCase()
          : null;

      const totalChunks =
        typeof body.totalChunks === 'number' &&
        Number.isInteger(body.totalChunks) &&
        body.totalChunks >= 0 &&
        body.totalChunks <= 1_000_000
          ? body.totalChunks
          : null;

      let state = this.rooms.get(room);
      if (!state) {
        state = {
          room,
          lastSeq: 0,
          updatedAt: now,
          peers: new Map(),
          messages: [],
        };
        this.rooms.set(room, state);
      }

      if (body.type === 'leave') {
        state.peers.delete(fromPeerId);
        const seq = ++state.lastSeq;
        state.updatedAt = now;
        state.messages.push({
          seq,
          room,
          fromPeerId,
          toPeerId: null,
          role: body.role,
          type: 'leave',
          rootHashHex: cleanRootHex,
          totalChunks,
          payload: null,
          createdAt: now,
        });
        if (state.messages.length > MAX_MESSAGES_PER_ROOM) {
          state.messages.splice(0, state.messages.length - MAX_MESSAGES_PER_ROOM);
        }
        return jsonResponse({
          ok: true,
          seq,
          room,
          peers: this.listOtherPeers(state, fromPeerId),
          serverTime: now,
        });
      }

      if (!state.peers.has(fromPeerId) && state.peers.size >= MAX_PEERS_PER_ROOM) {
        return jsonResponse(
          { error: `Swarm room "${room}" has reached maximum peer capacity (${MAX_PEERS_PER_ROOM})` },
          429
        );
      }

      const prev = state.peers.get(fromPeerId);
      state.peers.set(fromPeerId, {
        peerId: fromPeerId,
        role: body.role,
        rootHashHex: cleanRootHex ?? prev?.rootHashHex ?? null,
        totalChunks: totalChunks ?? prev?.totalChunks ?? null,
        updatedAt: now,
      });

      const seq = ++state.lastSeq;
      state.updatedAt = now;
      state.messages.push({
        seq,
        room,
        fromPeerId,
        toPeerId: toPeerIdRaw,
        role: body.role,
        type: body.type,
        rootHashHex: cleanRootHex ?? prev?.rootHashHex ?? null,
        totalChunks: totalChunks ?? prev?.totalChunks ?? null,
        payload: payloadCheck.sanitized,
        createdAt: now,
      });

      if (state.messages.length > MAX_MESSAGES_PER_ROOM) {
        state.messages.splice(0, state.messages.length - MAX_MESSAGES_PER_ROOM);
      }

      return jsonResponse({
        ok: true,
        seq,
        room,
        peers: this.listOtherPeers(state, fromPeerId),
        serverTime: now,
      });
    }

    return jsonResponse({ error: `Method ${request.method} not allowed` }, 405);
  }
}

export const defaultSwarmRelay = new SwarmSignalingRelay();
