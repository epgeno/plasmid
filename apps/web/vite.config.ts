import { existsSync, statSync, createReadStream } from 'node:fs'
import { resolve, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const publicDir = resolve(__dirname, 'public')

function plasmidLocalRangeMiddleware(): Plugin {
  const handler = (req: any, res: any, next: () => void) => {
    const rawUrl: string = req.url || ''
    const pathname = rawUrl.split('?')[0]
    if (!pathname.startsWith('/api/data/')) {
      next()
      return
    }

    const relKey = decodeURIComponent(pathname.slice('/api/data/'.length))
    if (!relKey || relKey.includes('..')) {
      next()
      return
    }

    const candidate = normalize(resolve(publicDir, relKey))
    if (!candidate.startsWith(publicDir) || !existsSync(candidate)) {
      next()
      return
    }

    const stat = statSync(candidate)
    if (!stat.isFile()) {
      next()
      return
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type')
      res.end()
      return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }

    const totalSize = stat.size
    const rangeHeader: string | undefined = req.headers['range']

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Range, Content-Length, Accept-Ranges, ETag'
    )
    res.setHeader('ETag', `"local-${totalSize}-${Math.trunc(stat.mtimeMs)}"`)

    if (rangeHeader && /^bytes=/i.test(rangeHeader.trim()) && !rangeHeader.includes(',')) {
      const spec = rangeHeader.trim().slice(6).trim()
      const match = /^(\d*)-(\d*)$/.exec(spec)
      if (!match || (match[1] === '' && match[2] === '') || totalSize === 0) {
        res.statusCode = 416
        res.setHeader('Content-Range', `bytes */${totalSize}`)
        res.end()
        return
      }

      let start = 0
      let end = totalSize - 1

      if (match[1] === '') {
        const suffix = Number(match[2])
        if (!Number.isFinite(suffix) || suffix <= 0) {
          res.statusCode = 416
          res.setHeader('Content-Range', `bytes */${totalSize}`)
          res.end()
          return
        }
        const len = Math.min(suffix, totalSize)
        start = totalSize - len
        end = totalSize - 1
      } else {
        start = Number(match[1])
        if (!Number.isFinite(start) || start < 0 || start >= totalSize) {
          res.statusCode = 416
          res.setHeader('Content-Range', `bytes */${totalSize}`)
          res.end()
          return
        }
        if (match[2] !== '') {
          const parsedEnd = Number(match[2])
          if (!Number.isFinite(parsedEnd) || parsedEnd < start) {
            res.statusCode = 416
            res.setHeader('Content-Range', `bytes */${totalSize}`)
            res.end()
            return
          }
          end = Math.min(parsedEnd, totalSize - 1)
        }
      }

      const length = end - start + 1
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`)
      res.setHeader('Content-Length', String(length))
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      createReadStream(candidate, { start, end }).pipe(res)
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Length', String(totalSize))
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    createReadStream(candidate).pipe(res)
  }

  return {
    name: 'plasmid-local-range-server',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [plasmidLocalRangeMiddleware(), react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://plasmid.wiki',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'https://plasmid.wiki',
        changeOrigin: true,
      },
    },
  },
})
