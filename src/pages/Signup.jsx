import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { checkUsernameAvailable, saveProfileSettings } from '../lib/avatar'
import './Login.css'

export default function Signup() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState(null) // null | 'checking' | 'available' | 'taken' | 'invalid'
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [sent, setSent]         = useState(false)
  const debounce = useRef(null)

  function handleUsernameChange(val) {
    setUsername(val)
    setUsernameStatus(null)
    clearTimeout(debounce.current)
    const trimmed = val.trim().toLowerCase()
    if (!trimmed) return
    if (!/^[a-z0-9_]{2,20}$/.test(trimmed)) {
      setUsernameStatus('invalid')
      return
    }
    setUsernameStatus('checking')
    debounce.current = setTimeout(async () => {
      const available = await checkUsernameAvailable(trimmed, 'none')
      setUsernameStatus(available ? 'available' : 'taken')
    }, 400)
  }

  async function handleSignup(e) {
    e.preventDefault()
    setError(null)

    const trimmedUsername = username.trim().toLowerCase()
    if (!trimmedUsername) { setError('Please choose a username.'); return }
    if (usernameStatus !== 'available') { setError('Please choose a valid, available username.'); return }

    setLoading(true)
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (err) { setError(err.message); setLoading(false); return }

    // Save username immediately - works even before email confirmation
    if (data?.user?.id) {
      await saveProfileSettings(data.user.id, {
        username: trimmedUsername,
        leaderboardVisibility: 'followers',
      })
    }

    setLoading(false)
    setSent(true)
  }

  async function handleGoogleSignup() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
  }

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-sent">
          <div className="auth-sent-icon">✉️</div>
          <h2 className="auth-sent-title">Check your email</h2>
          <p className="auth-sent-body">
            We sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
          </p>
        </div>
      </div>
    )
  }

  const usernameHint = {
    checking:  { text: 'Checking…',   color: 'var(--text-dim)' },
    available: { text: '✓ Available', color: 'var(--green)' },
    taken:     { text: '✕ Already taken', color: '#ef4444' },
    invalid:   { text: '2–20 characters: letters, numbers, underscores only', color: '#ef4444' },
  }[usernameStatus]

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Create an account</h1>
        <p className="auth-subtitle">
          Already have one? <Link to="/login" className="auth-link">Log in</Link>
        </p>

        <button onClick={handleGoogleSignup} className="auth-google-btn btn-press btn-hover">
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="auth-divider">
          <div className="auth-divider__line" />
          <span className="auth-divider__text">or</span>
          <div className="auth-divider__line" />
        </div>

        <form onSubmit={handleSignup} className="auth-form">
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => handleUsernameChange(e.target.value)}
              required
              className="auth-input"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            {usernameHint && (
              <p style={{ fontSize: '11px', color: usernameHint.color, marginTop: '3px' }}>
                {usernameHint.text}
              </p>
            )}
          </div>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="auth-input"
          />
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={8}
            required
            className="auth-input"
          />

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={loading || usernameStatus !== 'available'} className="auth-submit btn-press">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
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
