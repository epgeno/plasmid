import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { resolveContentRange } from '../.wrangler/test-build/worker.js';

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
