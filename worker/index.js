const SUGGEST_URLS = {
  google: 'https://suggestqueries.google.com/complete/search?client=firefox&q=',
  bing: 'https://api.bing.com/osjson.aspx?query=',
  baidu: 'https://suggestion.baidu.com/su?json=1&wd=',
  bilibili: 'https://s.search.bilibili.com/main/suggest?term=',
}

export default {
  async fetch(request) {
    const url = new URL(request.url)

    if (url.pathname !== '/suggest') {
      return new Response('Not found', { status: 404 })
    }

    const engine = url.searchParams.get('engine')
    const q = url.searchParams.get('q')

    if (!engine || !q || !SUGGEST_URLS[engine]) {
      return new Response('Bad request', { status: 400 })
    }

    const target = SUGGEST_URLS[engine] + encodeURIComponent(q)

    try {
      const res = await fetch(target, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })

      const buffer = await res.arrayBuffer()
      const contentType = res.headers.get('content-type') || ''
      let data

      if (contentType.includes('gbk') || contentType.includes('gb2312')) {
        data = new TextDecoder('gbk').decode(buffer)
      } else {
        data = new TextDecoder('utf-8').decode(buffer)
      }

      const jsonpStart = data.indexOf('(')
      const jsonpEnd = data.lastIndexOf(')')
      if (jsonpStart !== -1 && jsonpEnd > jsonpStart) {
        data = data.slice(jsonpStart + 1, jsonpEnd)
      }

      return new Response(data, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
          'Cache-Control': 'public, max-age=300',
        },
      })
    } catch {
      return new Response('Upstream error', { status: 502 })
    }
  },
}
