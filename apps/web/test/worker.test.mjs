import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {
  resolveContentRange,
  SwarmSignalingRelay,
} from '../.wrangler/test-build/worker.js';
import {
  packSwarmPieceFrame,
  unpackSwarmPieceFrame,
  validateSwarmBatchPrivacy,
  shouldInitiateWebRtc,
} from '../.wrangler/test-build/services/webrtcSwarm.js';

function createMockEnv(dataBytes) {
  return {
    ASSETS: {
      async fetch() {
        return new Response('spa', { status: 200 });
      },
    },
    GENOME_BUCKET: {
      async get(key, options) {
        if (key !== 'demo.plasmid') {
          return null;
        }

        const size = dataBytes.byteLength;
        const rangeHeaders = options?.range;
        const rawRange =
          rangeHeaders instanceof Headers ? rangeHeaders.get('range') : null;

        let r2Range;
        let slice = dataBytes;

        if (rawRange && /^bytes=/i.test(rawRange) && !rawRange.includes(',')) {
          const spec = rawRange.slice(6).trim();
          const match = /^(\d*)-(\d*)$/.exec(spec);
          if (match) {
            if (match[1] === '' && match[2] !== '') {
              const suffix = Number(match[2]);
              if (suffix > 0 && size > 0) {
                r2Range = { suffix };
                const len = Math.min(suffix, size);
                slice = dataBytes.subarray(size - len, size);
              }
            } else if (match[1] !== '') {
              const offset = Number(match[1]);
              if (offset < size) {
                if (match[2] !== '') {
                  const end = Number(match[2]);
                  if (end >= offset) {
                    const clampedEnd = Math.min(end, size - 1);
                    const length = clampedEnd - offset + 1;
                    r2Range = { offset, length };
                    slice = dataBytes.subarray(offset, offset + length);
                  }
                } else {
                  r2Range = { offset };
                  slice = dataBytes.subarray(offset);
                }
              }
            }
          }
        }

        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(slice);
            controller.close();
          },
        });

        return {
          key,
          size,
          httpEtag: '"demo-etag-1"',
          range: r2Range,
          body,
          writeHttpMetadata(headers) {
            headers.set('content-type', 'application/octet-stream');
          },
        };
      },
    },
  };
}

test('resolveContentRange handles {offset, length}, open offset, and {suffix} with clamping', () => {
  assert.deepEqual(
    resolveContentRange(147636, { offset: 0, length: 65536 }, 'bytes=0-65535'),
    {
      kind: 'partial',
      start: 0,
      end: 65535,
      length: 65536,
      header: 'bytes 0-65535/147636',
    }
  );

  // Offset + length exceeding total size clamps to size - 1
  assert.deepEqual(
    resolveContentRange(147636, { offset: 140000, length: 20000 }, 'bytes=140000-159999'),
    {
      kind: 'partial',
      start: 140000,
      end: 147635,
      length: 7636,
      header: 'bytes 140000-147635/147636',
    }
  );

  // Offset without length (open-ended range)
  assert.deepEqual(
    resolveContentRange(147636, { offset: 147000 }, 'bytes=147000-'),
    {
      kind: 'partial',
      start: 147000,
      end: 147635,
      length: 636,
      header: 'bytes 147000-147635/147636',
    }
  );

  // Suffix range within file size
  assert.deepEqual(
    resolveContentRange(147636, { suffix: 512 }, 'bytes=-512'),
    {
      kind: 'partial',
      start: 147124,
      end: 147635,
      length: 512,
      header: 'bytes 147124-147635/147636',
    }
  );

  // Suffix range larger than file size clamps to entire representation
  assert.deepEqual(
    resolveContentRange(1024, { suffix: 5000 }, 'bytes=-5000'),
    {
      kind: 'partial',
      start: 0,
      end: 1023,
      length: 1024,
      header: 'bytes 0-1023/1024',
    }
  );

  // Out-of-bounds range returns unsatisfiable (RFC 9110 416)
  assert.deepEqual(
    resolveContentRange(147636, undefined, 'bytes=200000-210000'),
    {
      kind: 'unsatisfiable',
      header: 'bytes */147636',
    }
  );
});

test('worker /api/data/* returns RFC 9110 Content-Range on 206, 200 on full GET, and 416 on invalid range', async () => {
  const payload = new Uint8Array(1000);
  for (let i = 0; i < payload.length; i++) payload[i] = i & 0xff;
  const env = createMockEnv(payload);

  // 1. Standard byte range request -> 206 Partial Content with Content-Range
  const partialRes = await worker.fetch(
    new Request('https://plasmid.wiki/api/data/demo.plasmid', {
      headers: { Range: 'bytes=100-299' },
    }),
    env
  );
  assert.equal(partialRes.status, 206);
  assert.equal(partialRes.headers.get('content-range'), 'bytes 100-299/1000');
  assert.equal(partialRes.headers.get('content-length'), '200');
  assert.equal(partialRes.headers.get('accept-ranges'), 'bytes');
  const partialBuf = new Uint8Array(await partialRes.arrayBuffer());
  assert.equal(partialBuf.byteLength, 200);
  assert.equal(partialBuf[0], 100);
  assert.equal(partialBuf[199], 299 & 0xff);

  // 2. Suffix byte range request -> 206 Partial Content with Content-Range
  const suffixRes = await worker.fetch(
    new Request('https://plasmid.wiki/api/data/demo.plasmid', {
      headers: { Range: 'bytes=-128' },
    }),
    env
  );
  assert.equal(suffixRes.status, 206);
  assert.equal(suffixRes.headers.get('content-range'), 'bytes 872-999/1000');
  assert.equal(suffixRes.headers.get('content-length'), '128');

  // 3. Full GET without Range -> 200 OK without Content-Range
  const fullRes = await worker.fetch(
    new Request('https://plasmid.wiki/api/data/demo.plasmid'),
    env
  );
  assert.equal(fullRes.status, 200);
  assert.equal(fullRes.headers.get('content-range'), null);
  assert.equal(fullRes.headers.get('content-length'), '1000');

  // 4. Out-of-bounds Range -> 416 Range Not Satisfiable with Content-Range: bytes */1000
  const invalidRes = await worker.fetch(
    new Request('https://plasmid.wiki/api/data/demo.plasmid', {
      headers: { Range: 'bytes=5000-6000' },
    }),
    env
  );
  assert.equal(invalidRes.status, 416);
  assert.equal(invalidRes.headers.get('content-range'), 'bytes */1000');
});

test('worker /api/swarm/signal relays announce/offer/answer/ice/leave per room and enforces RFC-0002/0003 & TTL', async () => {
  const env = createMockEnv(new Uint8Array(64));
  const rootHex = 'a'.repeat(64);

  // 1. CORS OPTIONS preflight
  const optRes = await worker.fetch(
    new Request('https://plasmid.wiki/api/swarm/signal', { method: 'OPTIONS' }),
    env
  );
  assert.equal(optRes.status, 204);
  assert.equal(optRes.headers.get('access-control-allow-origin'), '*');

  // 2. Seeder announces in room-alpha
  const seederAnnounce = await worker.fetch(
    new Request('https://plasmid.wiki/api/swarm/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: 'clinvar-room-alpha',
        fromPeerId: 'peer_seeder01',
        role: 'seeder',
        type: 'announce',
        rootHashHex: rootHex,
        totalChunks: 90,
      }),
    }),
    env
  );
  assert.equal(seederAnnounce.status, 200);
  const seederJson = await seederAnnounce.json();
  assert.equal(seederJson.ok, true);
  assert.equal(seederJson.peers.length, 0);

  // 3. Leecher announces in room-alpha -> immediately discovers Seeder
  const leecherAnnounce = await worker.fetch(
    new Request('https://plasmid.wiki/api/swarm/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: 'clinvar-room-alpha',
        fromPeerId: 'peer_leecher01',
        role: 'leecher',
        type: 'announce',
        rootHashHex: rootHex,
        totalChunks: 90,
      }),
    }),
    env
  );
  assert.equal(leecherAnnounce.status, 200);
  const leecherJson = await leecherAnnounce.json();
  assert.equal(leecherJson.peers.length, 1);
  assert.equal(leecherJson.peers[0].peerId, 'peer_seeder01');
  assert.equal(leecherJson.peers[0].role, 'seeder');

  // 4. Room isolation: peer in room-beta sees 0 messages from room-alpha
  const betaPoll = await worker.fetch(
    new Request(
      'https://plasmid.wiki/api/swarm/signal?room=clinvar-room-beta&peerId=peer_other99&after=0'
    ),
    env
  );
  const betaData = await betaPoll.json();
  assert.equal(betaData.messages.length, 0);
  assert.equal(betaData.peers.length, 0);

  // 5. Directed SDP offer (leecher -> seeder) + answer (seeder -> leecher) + ICE
  const offerPost = await worker.fetch(
    new Request('https://plasmid.wiki/api/swarm/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: 'clinvar-room-alpha',
        fromPeerId: 'peer_leecher01',
        toPeerId: 'peer_seeder01',
        role: 'leecher',
        type: 'offer',
        payload: { type: 'offer', sdp: 'v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n' },
      }),
    }),
    env
  );
  assert.equal(offerPost.status, 200);

  // Third observer in same room must NOT receive directed offer meant for peer_seeder01
  const observerPoll = await worker.fetch(
    new Request(
      'https://plasmid.wiki/api/swarm/signal?room=clinvar-room-alpha&peerId=peer_observer02&after=0'
    ),
    env
  );
  const obsData = await observerPoll.json();
  assert.ok(obsData.messages.every((m) => m.type !== 'offer'));

  // Seeder polls and receives both leecher's announce and directed offer
  const seederPoll = await worker.fetch(
    new Request(
      `https://plasmid.wiki/api/swarm/signal?room=clinvar-room-alpha&peerId=peer_seeder01&after=${seederJson.seq}`
    ),
    env
  );
  const seederPollData = await seederPoll.json();
  assert.equal(seederPollData.messages.length, 2);
  assert.equal(seederPollData.messages[0].type, 'announce');
  assert.equal(seederPollData.messages[1].type, 'offer');

  // Leave removes peer from room presence
  const leaveRes = await worker.fetch(
    new Request('https://plasmid.wiki/api/swarm/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: 'clinvar-room-alpha',
        fromPeerId: 'peer_leecher01',
        role: 'leecher',
        type: 'leave',
      }),
    }),
    env
  );
  assert.equal(leaveRes.status, 200);
  const afterLeavePoll = await worker.fetch(
    new Request(
      'https://plasmid.wiki/api/swarm/signal?room=clinvar-room-alpha&peerId=peer_seeder01&after=0'
    ),
    env
  );
  const afterLeaveData = await afterLeavePoll.json();
  assert.equal(afterLeaveData.peers.length, 0);

  // 6. RFC-0003: proprietary room names (OMIM/COSMIC/HGMD/SNPedia) rejected with 403
  const omimRes = await worker.fetch(
    new Request('https://plasmid.wiki/api/swarm/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: 'omim-private-pack',
        fromPeerId: 'peer_bad01',
        role: 'seeder',
        type: 'announce',
      }),
    }),
    env
  );
  assert.equal(omimRes.status, 403);

  // 7. RFC-0002: raw VCF / headerless #CHROM\tPOS / 23andMe / arbitrary announce payload rejected with 400 & 0 stored records
  for (const leakBody of [
    {
      room: 'clinvar-clean',
      fromPeerId: 'peer_leak01',
      role: 'leecher',
      type: 'announce',
      payload: '##fileformat=VCFv4.3\n#CHROM\tPOS\tID\nchr1\t100\trs1\n',
    },
    {
      room: 'clinvar-clean',
      fromPeerId: 'peer_leak02',
      role: 'leecher',
      type: 'announce',
      payload: '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\nchr17\t43094464\trs80357906\tG\tA\t.\tPASS\t.',
    },
    {
      room: 'clinvar-clean',
      fromPeerId: 'peer_leak03',
      role: 'leecher',
      type: 'announce',
      payload: '# rsid\tchromosome\tposition\tgenotype\nrs4477212\t1\t82154\tAA',
    },
    {
      room: 'clinvar-clean',
      fromPeerId: 'peer_leak04',
      toPeerId: 'peer_seeder01',
      role: 'leecher',
      type: 'offer',
      payload: {
        type: 'offer',
        sdp: 'v=0\r\nchr17\t43094464\trs80357906\tG\tA\t.\tPASS\t.\r\n',
      },
    },
    {
      room: 'clinvar-clean',
      fromPeerId: 'peer_leak05',
      role: 'leecher',
      type: 'announce',
      payload: { arbitrary: 'unexpected-announce-body' },
    },
  ]) {
    const vcfLeakRes = await worker.fetch(
      new Request('https://plasmid.wiki/api/swarm/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leakBody),
      }),
      env
    );
    assert.equal(vcfLeakRes.status, 400);
  }
  const cleanRoomCheck = await worker.fetch(
    new Request('https://plasmid.wiki/api/swarm/signal?room=clinvar-clean&peerId=qa_probe&after=0'),
    env
  );
  const cleanRoomData = await cleanRoomCheck.json();
  assert.equal(cleanRoomData.peers.length, 0);
  assert.equal(cleanRoomData.messages.length, 0);

  // 8. Custom clock TTL pruning on SwarmSignalingRelay + HTTP 405 & 413 checks
  let fakeNow = 1_000_000;
  const relay = new SwarmSignalingRelay(() => fakeNow);
  await relay.handleRequest(
    new Request('https://plasmid.wiki/api/swarm/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: 'ttl-room',
        fromPeerId: 'peer_ephemeral',
        role: 'seeder',
        type: 'announce',
      }),
    })
  );
  fakeNow += 65_000; // Advance past 45s peer TTL and 60s message TTL
  const expiredPoll = await relay.handleRequest(
    new Request('https://plasmid.wiki/api/swarm/signal?room=ttl-room&peerId=peer_watcher&after=0')
  );
  const expiredData = await expiredPoll.json();
  assert.equal(expiredData.peers.length, 0);
  assert.equal(expiredData.messages.length, 0);

  const method405 = await relay.handleRequest(
    new Request('https://plasmid.wiki/api/swarm/signal', { method: 'DELETE' })
  );
  assert.equal(method405.status, 405);

  const large413 = await relay.handleRequest(
    new Request('https://plasmid.wiki/api/swarm/signal', {
      method: 'POST',
      body: 'x'.repeat(40_000),
    })
  );
  assert.equal(large413.status, 413);
});

test('WebRTC PLPK binary piece framing, glare-free initiator, and K-anonymity >=2 batch guard', () => {
  // 1. K-anonymity guard rejects single-chunk requests on multi-chunk containers
  const singleRejected = validateSwarmBatchPrivacy([7], 90);
  assert.equal(singleRejected.ok, false);

  const validBatch = validateSwarmBatchPrivacy([4, 5, 4], 90);
  assert.equal(validBatch.ok, true);
  assert.deepEqual(validBatch.uniqueIndices, [4, 5]);

  // 2. Deterministic glare-free initiator: Leecher initiates to Seeder
  assert.equal(shouldInitiateWebRtc('peer_aaa', 'leecher', 'peer_zzz', 'seeder'), true);
  assert.equal(shouldInitiateWebRtc('peer_aaa', 'seeder', 'peer_zzz', 'leecher'), false);
  assert.equal(shouldInitiateWebRtc('peer_aaa', 'leecher', 'peer_zzz', 'leecher'), false);

  // 3. PLPK binary chunk packet roundtrip (16,384-byte payload)
  const chunk = new Uint8Array(16384);
  for (let i = 0; i < chunk.length; i++) chunk[i] = (i * 31) & 0xff;
  const meta = {
    requestId: 'batch_req_1',
    chunkIndex: 3,
    totalChunks: 90,
    chunkSize: 16384,
    leafSha256Hex: 'b'.repeat(64),
    rootHashHex: 'c'.repeat(64),
    proof: [{ sibling_hex: 'd'.repeat(64), is_right: true }],
  };
  const frame = packSwarmPieceFrame(meta, chunk);
  const unpacked = unpackSwarmPieceFrame(frame.buffer);
  assert.deepEqual(unpacked.meta, meta);
  assert.equal(unpacked.chunkBytes.byteLength, 16384);
  assert.deepEqual(unpacked.chunkBytes, chunk);
});
