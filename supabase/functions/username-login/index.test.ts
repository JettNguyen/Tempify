import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from './index.ts'

const ENV: Record<string, string> = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  SUPABASE_ANON_KEY: 'anon',
}

// Supabase as the function sees it: one player, sam, whose password is right.
function fakeSupabase(url: string, init?: RequestInit) {
  if (url.includes('/rest/v1/users')) {
    const found = url.includes('username=eq.sam&')
    return new Response(JSON.stringify(found ? [{ email: 'sam@example.com' }] : []), { status: 200 })
  }
  const { email, password } = JSON.parse(String(init?.body))
  if (email === 'sam@example.com' && password === 'right') {
    return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { email } }), { status: 200 })
  }
  return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })
}

const post = (body: unknown) =>
  handler(new Request('https://x/functions/v1/username-login', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  vi.stubGlobal('Deno', { env: { get: (k: string) => ENV[k] } })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => fakeSupabase(url, init)))
})

describe('signing in with a username', () => {
  it('returns a session and never the email', async () => {
    const res = await post({ username: ' Sam ', password: 'right' })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ access_token: 'a', refresh_token: 'r' })
    expect(text).not.toContain('sam@example.com')
  })

  it('gives the same answer for a wrong password and an unknown name', async () => {
    const wrong = await post({ username: 'sam', password: 'nope' })
    const unknown = await post({ username: 'nobody', password: 'right' })
    expect(wrong.status).toBe(400)
    expect(await wrong.json()).toEqual({ error: 'no_match' })
    expect(unknown.status).toBe(400)
    expect(await unknown.json()).toEqual({ error: 'no_match' })
  })

  it('passes on being told to slow down', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) =>
      url.includes('/auth/v1/') ? new Response('{}', { status: 429 }) : fakeSupabase(url, init)))
    expect((await post({ username: 'sam', password: 'right' })).status).toBe(429)
  })

  it('refuses anything that is not a sign-in', async () => {
    expect((await post({ username: '', password: 'x' })).status).toBe(400)
    expect((await handler(new Request('https://x', { method: 'GET' }))).status).toBe(405)
    expect((await handler(new Request('https://x', { method: 'POST', body: 'not json' }))).status).toBe(400)
  })
})
