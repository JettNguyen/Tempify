import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  // Verify the caller is authenticated
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: corsHeaders({ 'Content-Type': 'application/json' }),
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Use the user's JWT to identify them
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: corsHeaders({ 'Content-Type': 'application/json' }),
    })
  }

  // Use admin client to delete the auth user (cascades to users table via FK)
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)

  if (deleteError) {
    console.error('[delete-user] Failed to delete user:', deleteError)
    return new Response(JSON.stringify({ error: 'delete_failed', message: deleteError.message }), {
      status: 500,
      headers: corsHeaders({ 'Content-Type': 'application/json' }),
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: corsHeaders({ 'Content-Type': 'application/json' }),
  })
}
