export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
      },
    })
  }

  const requestUrl = new URL(req.url)
  const proxiedPath = requestUrl.pathname.replace(/^\/itunes-proxy/, '') || '/search'
  const targetUrl = `https://itunes.apple.com${proxiedPath}${requestUrl.search}`

  const response = await fetch(targetUrl, {
    method: req.method,
    headers: {
      accept: 'application/json',
    },
  })

  const body = await response.text()
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey')

  return new Response(body, {
    status: response.status,
    headers,
  })
}
