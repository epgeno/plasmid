import { defaultSwarmRelay, SwarmSignalingRelay } from './services/signalingRelay.js';

export { SwarmSignalingRelay };

export interface Env {
  ASSETS: Fetcher;
  GENOME_BUCKET?: R2Bucket;
}

export type ResolvedContentRange =
  | {
      kind: 'partial';
      start: number;
      end: number;
      length: number;
      header: string;
    }
  | {
      kind: 'unsatisfiable';
      header: string;
    }
  | {
      kind: 'full';
    };

/**
 * Computes RFC 9110 Section 14.4 `Content-Range` metadata from R2 `object.range`,
 * `object.size`, and the incoming HTTP `Range` request header.
 */
export function resolveContentRange(
  objectSize: number,
  objectRange?: R2Range,
  rangeHeader?: string | null
): ResolvedContentRange {
  const unsatisfiedHeader = `bytes */${objectSize}`;

  // Validate single-range HTTP `Range: bytes=...` syntax when provided
  if (rangeHeader) {
    const trimmed = rangeHeader.trim();
    if (/^bytes=/i.test(trimmed) && !trimmed.includes(',')) {
      const spec = trimmed.slice(6).trim();
      const match = /^(\d*)-(\d*)$/.exec(spec);
      if (!match || (match[1] === '' && match[2] === '')) {
        return { kind: 'unsatisfiable', header: unsatisfiedHeader };
      }

      if (objectSize === 0) {
        return { kind: 'unsatisfiable', header: unsatisfiedHeader };
      }

      if (match[1] === '') {
        // Suffix byte-range-spec: bytes=-<suffix>
        const suffix = Number(match[2]);
        if (!Number.isFinite(suffix) || suffix <= 0) {
          return { kind: 'unsatisfiable', header: unsatisfiedHeader };
        }
      } else {
        const start = Number(match[1]);
        if (!Number.isFinite(start) || start < 0 || start >= objectSize) {
          return { kind: 'unsatisfiable', header: unsatisfiedHeader };
        }
        if (match[2] !== '') {
          const end = Number(match[2]);
          if (!Number.isFinite(end) || end < start) {
            return { kind: 'unsatisfiable', header: unsatisfiedHeader };
          }
        }
      }
    }
  }

  if (!objectRange) {
    return { kind: 'full' };
  }

  if (objectSize <= 0) {
    return { kind: 'unsatisfiable', header: unsatisfiedHeader };
  }

  const rangeObj = objectRange as { offset?: number; length?: number; suffix?: number };
  if (typeof rangeObj.suffix === 'number') {
    if (!Number.isFinite(rangeObj.suffix) || rangeObj.suffix <= 0) {
      return { kind: 'unsatisfiable', header: unsatisfiedHeader };
    }
    const length = Math.min(rangeObj.suffix, objectSize);
    const start = objectSize - length;
    const end = objectSize - 1;
    return {
      kind: 'partial',
      start,
      end,
      length,
      header: `bytes ${start}-${end}/${objectSize}`,
    };
  }

  const start = rangeObj.offset ?? 0;
  if (start < 0 || start >= objectSize) {
    return { kind: 'unsatisfiable', header: unsatisfiedHeader };
  }

  const remaining = objectSize - start;
  const length =
    rangeObj.length !== undefined
      ? Math.min(rangeObj.length, remaining)
      : remaining;

  if (length <= 0) {
    return { kind: 'unsatisfiable', header: unsatisfiedHeader };
  }

  const end = start + length - 1;
  return {
    kind: 'partial',
    start,
    end,
    length,
    header: `bytes ${start}-${end}/${objectSize}`,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API: Genomic data range streaming from Cloudflare R2
    if (url.pathname.startsWith('/api/data/')) {
      if (!env.GENOME_BUCKET) {
        return new Response(
          JSON.stringify({
            error: 'R2 storage bucket is not yet bound to this Worker.',
            hint: 'Please enable R2 in Cloudflare Dashboard and bind GENOME_BUCKET.',
          }),
          {
            status: 503,
            headers: {
              'content-type': 'application/json',
              'access-control-allow-origin': '*',
            },
          }
        );
      }

      const key = url.pathname.replace('/api/data/', '');
      const rangeHeader = request.headers.get('range');

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, HEAD, OPTIONS',
            'access-control-allow-headers': 'Range, Content-Type',
            'access-control-max-age': '86400',
          },
        });
      }

      const object = await env.GENOME_BUCKET.get(key, {
        range: request.headers,
        onlyIf: request.headers,
      });

      if (!object) {
        return new Response('Genomic resource not found', { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('access-control-allow-origin', '*');
      headers.set(
        'access-control-expose-headers',
        'Content-Range, Content-Length, Accept-Ranges, ETag'
      );
      headers.set('accept-ranges', 'bytes');

      if (!('body' in object)) {
        return new Response(null, {
          status: 304,
          headers,
        });
      }

      const resolvedRange = resolveContentRange(
        object.size,
        object.range,
        rangeHeader
      );

      if (resolvedRange.kind === 'unsatisfiable') {
        headers.set('content-range', resolvedRange.header);
        return new Response(null, {
          status: 416,
          headers,
        });
      }

      if (resolvedRange.kind === 'partial') {
        headers.set('content-range', resolvedRange.header);
        headers.set('content-length', String(resolvedRange.length));
        return new Response(request.method === 'HEAD' ? null : object.body, {
          headers,
          status: 206,
        });
      }

      headers.set('content-length', String(object.size));
      return new Response(request.method === 'HEAD' ? null : object.body, {
        headers,
        status: 200,
      });
    }

    // API: WebRTC P2P Swarm Ephemeral Signaling Relay
    if (url.pathname === '/api/swarm/signal') {
      return defaultSwarmRelay.handleRequest(request);
    }

    // Health & edge status check
    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          app: 'plasmid-web',
          domain: 'plasmid.wiki',
          version: '0.1.0',
          r2_bound: Boolean(env.GENOME_BUCKET),
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            'content-type': 'application/json',
            'access-control-allow-origin': '*',
          },
        }
      );
    }

    // Default: Serve React 19 SPA via Static Assets binding
    return env.ASSETS.fetch(request);
  },
};
