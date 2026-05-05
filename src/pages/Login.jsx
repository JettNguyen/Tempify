import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { signInWithGoogleOAuth, signInWithApple } from '../lib/oauth'
import { getEmailByUsername } from '../lib/avatar'
import { useAuth } from '../hooks/useAuth'
import './Login.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'
  const { user } = useAuth()

  const [identifier, setIdentifier] = useState('') // email or username
  const [password, setPassword]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  useEffect(() => {
    if (!user) return

    const oauthProvider = sessionStorage.getItem('tempify-oauth-provider')
    if (oauthProvider === 'google' || oauthProvider === 'apple') {
      sessionStorage.removeItem('tempify-oauth-provider')
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  async function handleEmailLogin(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    let email = identifier.trim()

    // If no @ it's a username - look up the real email
    if (!email.includes('@')) {
      const found = await getEmailByUsername(email)
      if (!found) {
        setError('No account found with that username.')
        setLoading(false)
        return
      }
      email = found
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      navigate(from, { replace: true })
    }
  }

  async function handleGoogleLogin() {
    sessionStorage.setItem('tempify-oauth-provider', 'google')
    await signInWithGoogleOAuth()
  }

  async function handleAppleLogin() {
    sessionStorage.setItem('tempify-oauth-provider', 'apple')
    try {
      await signInWithApple()
    } catch (err) {
      sessionStorage.removeItem('tempify-oauth-provider')
      console.error('[Tempify] Apple login failed:', err)
      setError(`Sign in with Apple failed: ${err?.message || err}`)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">
          Don't have an account? <Link to="/signup" className="auth-link">Sign up</Link>
        </p>

        <div className="auth-social-group">
          <button onClick={handleAppleLogin} className="auth-apple-btn btn-press btn-hover">
            <AppleIcon />
            Continue with Apple
          </button>
          <button onClick={handleGoogleLogin} className="auth-google-btn btn-press btn-hover">
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <div className="auth-divider">
          <div className="auth-divider__line" />
          <span className="auth-divider__text">or</span>
          <div className="auth-divider__line" />
        </div>

        <form onSubmit={handleEmailLogin} className="auth-form">
          <input
            type="text"
            placeholder="Username or email"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            required
            className="auth-input"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="auth-input"
          />

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={loading} className="auth-submit btn-press">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

function AppleIcon() {
  return (
    <svg width="15" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.28.07 2.18.74 3.01.8 1.15-.24 2.25-.93 3.48-.84 1.47.12 2.58.7 3.31 1.79-3.01 1.86-2.3 5.6.46 6.76-.58 1.5-1.28 2.97-2.26 4.37zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
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
