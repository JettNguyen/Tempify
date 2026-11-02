// Signs in with a username instead of an email. The email behind a username
// never reaches the browser: it's looked up and used here, and the browser
// gets back either a session or a plain "didn't match". The password check
// is Supabase Auth's own, so its rate limits still apply.

declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Promise<Response>): unknown
}

function corsHeaders(base: Record<string, string> = {}) {
  return {
    ...base,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  }
}

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders({ 'Content-Type': 'application/json' }),
  })
}

export async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' })

  let username = ''
  let password = ''
  try {
    const body = await req.json()
    username = String(body?.username ?? '').trim().toLowerCase()
    password = String(body?.password ?? '')
  } catch {
    return reply(400, { error: 'bad_request' })
  }
  if (!username || !password || username.length > 64) return reply(400, { error: 'no_match' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const lookup = await fetch(
    `${supabaseUrl}/rest/v1/users?select=email&username=eq.${encodeURIComponent(username)}&limit=1`,
    { headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey } },
  )
  if (!lookup.ok) return reply(502, { error: 'lookup_failed' })
  const email = (await lookup.json())?.[0]?.email
  // The same answer as a wrong password, so this can't be used to learn
  // which usernames have a password to guess.
  if (!email) return reply(400, { error: 'no_match' })

  const token = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': anonKey },
    body: JSON.stringify({ email, password }),
  })
  if (token.status === 429) return reply(429, { error: 'too_many_tries' })
  if (!token.ok) return reply(400, { error: 'no_match' })

  const session = await token.json()
  return reply(200, { access_token: session.access_token, refresh_token: session.refresh_token })
}

// Supabase only answers requests handed to Deno.serve. A default export alone
// started the function and left every request waiting until it timed out.
Deno.serve(handler)
