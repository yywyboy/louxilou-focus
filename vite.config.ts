import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import https from 'https'
import http from 'http'
import iconv from 'iconv-lite'

const SUGGEST_URLS: Record<string, string> = {
  google: 'https://suggestqueries.google.com/complete/search?client=firefox&q=',
  bing: 'https://api.bing.com/osjson.aspx?query=',
  baidu: 'https://suggestion.baidu.com/su?json=1&wd=',
  bilibili: 'https://s.search.bilibili.com/main/suggest?term=',
}

function suggestProxy() {
  return {
    name: 'suggest-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/suggest', (req: any, res: any) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`)
        const engine = url.searchParams.get('engine')
        const q = url.searchParams.get('q')

        if (!engine || !q || !SUGGEST_URLS[engine]) {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end('Bad request')
          return
        }

        const target = SUGGEST_URLS[engine] + encodeURIComponent(q)
        console.log(`[suggest] ${engine}: ${target}`)

        const client = target.startsWith('https') ? https : http

        client.get(target, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (upstream) => {
          const chunks: Buffer[] = []
          upstream.on('data', (chunk: Buffer) => { chunks.push(chunk) })
          upstream.on('end', () => {
            const buf = Buffer.concat(chunks)
            const contentType = upstream.headers['content-type'] || ''
            let data: string
            if (contentType.includes('gbk') || contentType.includes('gb2312')) {
              data = iconv.decode(buf, 'gbk')
            } else {
              data = buf.toString('utf-8')
            }

            const jsonpStart = data.indexOf('(')
            const jsonpEnd = data.lastIndexOf(')')
            if (jsonpStart !== -1 && jsonpEnd > jsonpStart) {
              data = data.slice(jsonpStart + 1, jsonpEnd)
            }

            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
            })
            res.end(data)
          })
        }).on('error', (err: Error) => {
          console.error(`[suggest] ${engine} error:`, err.message)
          res.writeHead(502, { 'Content-Type': 'text/plain' })
          res.end('Upstream error')
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), suggestProxy()],
})
