declare const Deno: { env: { get(key: string): string } }

function corsHeaders(base: Record<string, string> = {}) {
  return {
    ...base,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  }
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: corsHeaders({ 'Content-Type': 'application/json' }),
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: corsHeaders({ 'Content-Type': 'application/json' }),
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Verify the caller's JWT and get their user ID
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'Authorization': authHeader,
      'apikey': serviceRoleKey,
    },
  })

  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: corsHeaders({ 'Content-Type': 'application/json' }),
    })
  }

  const { id: userId } = await userRes.json()

  // Delete the user via the admin API
  const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
    },
  })

  if (!deleteRes.ok) {
    const body = await deleteRes.json().catch(() => ({}))
    return new Response(JSON.stringify({ error: 'delete_failed', message: body?.message }), {
      status: 500,
      headers: corsHeaders({ 'Content-Type': 'application/json' }),
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: corsHeaders({ 'Content-Type': 'application/json' }),
  })
}
