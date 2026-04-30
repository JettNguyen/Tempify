function buildCorsHeaders(baseHeaders = {}) {
  const headers = new Headers(baseHeaders)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info')
  headers.set('Access-Control-Max-Age', '86400')
  return headers
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(),
    })
  }

  const requestUrl = new URL(req.url)
  const proxiedPath = requestUrl.pathname
    .replace(/^\/functions\/v1\/itunes-proxy/, '')
    .replace(/^\/itunes-proxy/, '') || '/search'
  const targetUrl = `https://itunes.apple.com${proxiedPath}${requestUrl.search}`

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        accept: 'application/json',
      },
    })

    const body = await response.text()
    return new Response(body, {
      status: response.status,
      headers: buildCorsHeaders(response.headers),
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'proxy_error', message: String(error) }), {
      status: 502,
      headers: buildCorsHeaders({ 'Content-Type': 'application/json' }),
    })
  }
}
