import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { saveProfileSettings, checkUsernameAvailable } from '../lib/avatar'
import './UsernameSetupModal.css'

export default function UsernameSetupModal() {
  const { user, profile, refreshProfile } = useAuth()
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const providers = user?.app_metadata?.providers || []
  const provider = user?.app_metadata?.provider
  const isGoogleAuth = provider === 'google' || providers.includes('google')

  // Only show for Google auth users who still need a username.
  if (!user || !profile || profile.username || !isGoogleAuth) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const trimmed = username.trim().toLowerCase()
    if (!/^[a-z0-9_]{2,20}$/.test(trimmed)) {
      setError('2–20 characters: letters, numbers, underscores only.')
      return
    }

    setSaving(true)
    const available = await checkUsernameAvailable(trimmed, user.id)
    if (!available) {
      setError('That username is already taken.')
      setSaving(false)
      return
    }

    await saveProfileSettings(user.id, {
      username: trimmed,
      leaderboardVisibility: profile.leaderboard_visibility || 'followers',
    })
    await refreshProfile()
    setSaving(false)
  }

  return (
    <div className="username-modal__backdrop">
      <div className="username-modal__card">
        <p className="username-modal__eyebrow">welcome to tempify</p>
        <h2 className="username-modal__title">Pick a username</h2>
        <p className="username-modal__sub">
          This is how you'll appear on leaderboards and public profiles.
        </p>

        <form onSubmit={handleSubmit} className="username-modal__form">
          <div className="username-modal__input-wrap">
            <span className="username-modal__at">@</span>
            <input
              autoFocus
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              placeholder="yourname"
              maxLength={20}
              className="username-modal__input"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          {error && <p className="username-modal__error">{error}</p>}

          <p className="username-modal__hint">
            Letters, numbers, underscores · 2–20 characters
          </p>

          <button
            type="submit"
            disabled={saving || username.trim().length < 2}
            className="username-modal__btn btn-press"
          >
            {saving ? 'Checking…' : 'Set username'}
          </button>
        </form>
      </div>
    </div>
  )
}
