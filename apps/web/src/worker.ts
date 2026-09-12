export interface Env {
  ASSETS: Fetcher;
  GENOME_BUCKET?: R2Bucket;
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
      headers.set('access-control-expose-headers', 'Content-Range, Content-Length, Accept-Ranges, ETag');
      headers.set('accept-ranges', 'bytes');

      if (!('body' in object)) {
        return new Response(null, {
          status: 304,
          headers,
        });
      }

      const status = rangeHeader ? 206 : 200;
      return new Response(object.body, {
        headers,
        status,
      });
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
