import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('[Tempify] Supabase env vars missing — auth and data features are disabled.')
}

// Fall back to placeholder values so the app renders without crashing.
// All auth/data calls will fail gracefully when credentials aren't configured.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder',
  {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)
