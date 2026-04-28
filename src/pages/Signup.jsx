import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  async function handleSignup(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + '/Tempify/' },
    })
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
  }

  async function handleGoogleSignup() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/Tempify/' },
    })
  }

  if (sent) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}>
        <div style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', marginBottom: '1rem' }}>✉️</div>
          <h2 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Check your email
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            We sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <h1 style={{
          fontSize: '20px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
          letterSpacing: '-0.02em',
        }}>
          Create an account
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Already have one? <Link to="/login" style={{ color: 'var(--text-primary)' }}>Log in</Link>
        </p>

        <button
          onClick={handleGoogleSignup}
          className="btn-press"
          style={{
            width: '100%',
            padding: '10px 16px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: 'pointer',
            marginBottom: '1.25rem',
            transition: 'background 80ms ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#222222'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            style={inputStyle}
          />

          {error && (
            <p style={{ fontSize: '12px', color: '#ef4444' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-press"
            style={{
              width: '100%',
              padding: '10px',
              background: 'var(--amber)',
              border: 'none',
              borderRadius: '8px',
              color: '#0f0f0f',
              fontSize: '14px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginTop: '0.25rem',
            }}
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '10px 14px',
  color: 'var(--text-primary)',
  fontSize: '14px',
  outline: 'none',
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
