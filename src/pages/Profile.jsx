import { useState, useEffect, useRef } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../hooks/useAuth'
import { AVATAR_ICONS, AVATAR_COLORS, saveAvatar, saveProfileSettings, checkUsernameAvailable } from '../lib/avatar'
import { openExternalUrlInApp } from '../lib/inAppBrowser'
import Avatar from '../components/Avatar'
import './Profile.css'
import './Dashboard.css'

const VISIBILITY_OPTIONS = [
  { value: 'public',    label: 'Public',         desc: 'Anyone can see your scores on the global leaderboard', premium: true },
  { value: 'followers', label: 'Followers only', desc: 'Only people you follow can see your scores', premium: false },
  { value: 'nobody',    label: 'Private',        desc: 'Your scores never appear on any leaderboard', premium: false },
]

export default function Profile() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [selectedIcon, setSelectedIcon] = useState(null)
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0].hex)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [savedAvatar, setSavedAvatar] = useState(false)

  const [username, setUsername] = useState('')
  const [visibility, setVisibility] = useState('followers')
  const [usernameError, setUsernameError] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [savedSettings, setSavedSettings] = useState(false)

  const synced = useRef(false)

  useEffect(() => {
    if (profile && !synced.current) {
      synced.current = true
      if (profile.avatar_icon) setSelectedIcon(profile.avatar_icon)
      if (profile.avatar_color) setSelectedColor(profile.avatar_color)
      if (profile.username) setUsername(profile.username)
      if (profile.leaderboard_visibility) setVisibility(profile.leaderboard_visibility)
    }
  }, [profile])

  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: '/profile' }} replace />

  const initial = (profile?.email || user.email || '').split('@')[0][0]?.toUpperCase() ?? '?'
  const isSubscribed = profile?.is_subscribed
  const customerPortalUrl = import.meta.env.VITE_STRIPE_CUSTOMER_PORTAL_URL

  const avatarDirty =
    selectedIcon !== (profile?.avatar_icon ?? null) ||
    selectedColor !== (profile?.avatar_color ?? AVATAR_COLORS[0].hex)

  const settingsDirty =
    username !== (profile?.username ?? '') ||
    visibility !== (profile?.leaderboard_visibility ?? 'followers')

  async function handleSaveAvatar() {
    if (!avatarDirty || savingAvatar) return
    setSavingAvatar(true)
    try {
      await saveAvatar(user.id, { icon: selectedIcon, color: selectedColor })
      await refreshProfile()
      setSavedAvatar(true)
      setTimeout(() => setSavedAvatar(false), 2000)
    } finally { setSavingAvatar(false) }
  }

  async function handleSaveSettings() {
    if (!settingsDirty || savingSettings) return
    setUsernameError('')
    const trimmed = username.trim().toLowerCase()
    if (trimmed && !/^[a-z0-9_]{2,20}$/.test(trimmed)) {
      setUsernameError('Username must be 2–20 characters: letters, numbers, underscores only.')
      return
    }
    if (trimmed && trimmed !== profile?.username) {
      const available = await checkUsernameAvailable(trimmed, user.id)
      if (!available) { setUsernameError('That username is already taken.'); return }
    }
    setSavingSettings(true)
    try {
      await saveProfileSettings(user.id, { username: trimmed || null, leaderboardVisibility: visibility })
      await refreshProfile()
      setSavedSettings(true)
      setTimeout(() => setSavedSettings(false), 2000)
    } finally { setSavingSettings(false) }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  async function handleManageBillingClick(event) {
    event.preventDefault()
    await openExternalUrlInApp(customerPortalUrl)
  }

  return (
    <div className="page-shell-narrow">
      {/* Header */}
      <div className="profile-header">
        <Avatar iconKey={selectedIcon} color={selectedColor} initial={initial} size={56} />
        <div style={{ flex: 1 }}>
          <div className="profile-email">{profile?.username ? `@${profile.username}` : (profile?.email || user.email)}</div>
          <span className={`profile-badge${isSubscribed ? ' profile-badge--subscribed' : ''}`}>
            {isSubscribed ? 'Premium' : 'Free plan'}
          </span>
        </div>
        {profile?.username && (
          <Link to={`/u/${profile.username}`} style={{ fontSize: '12px', color: 'var(--amber)', whiteSpace: 'nowrap' }}>
            My profile →
          </Link>
        )}
      </div>

      {/* Username + leaderboard settings */}
      <div className="profile-section">
        <p className="profile-section-label">public profile</p>

        <div style={{ marginBottom: '0.75rem' }}>
          <p className="profile-picker-label">username</p>
          <input
            value={username}
            onChange={e => { setUsername(e.target.value); setUsernameError('') }}
            placeholder="yourname"
            maxLength={20}
            style={{
              width: '100%', background: '#111', border: '1px solid var(--border)',
              borderRadius: '6px', padding: '8px 10px', color: 'var(--text-primary)',
              fontSize: '13px', outline: 'none',
            }}
          />
          {usernameError && <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>{usernameError}</p>}
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Letters, numbers, underscores. Used for your public profile URL.
          </p>
        </div>

        <p className="profile-picker-label">leaderboard visibility</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
          {VISIBILITY_OPTIONS.map(opt => {
            const locked = opt.premium && !isSubscribed
            const active = visibility === opt.value
            return (
              <button key={opt.value} type="button" disabled={locked}
                onClick={() => !locked && setVisibility(opt.value)}
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: '8px',
                  border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
                  background: active ? 'var(--amber-glow)' : 'transparent',
                  cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1,
                }}>
                <div style={{ fontSize: '13px', color: active ? 'var(--amber)' : 'var(--text-primary)', fontWeight: 500 }}>
                  {opt.label}
                  {opt.premium && !isSubscribed && <span style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--amber)' }}>Premium</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{opt.desc}</div>
              </button>
            )
          })}
        </div>

        <button onClick={handleSaveSettings} disabled={!settingsDirty || savingSettings}
          className={`profile-save-btn btn-press${settingsDirty ? ' profile-save-btn--dirty' : ''}`}>
          {savedSettings ? 'Saved' : savingSettings ? 'Saving…' : 'Save profile settings'}
        </button>
      </div>

      {/* Avatar */}
      <div className="profile-section">
        <p className="profile-section-label">avatar</p>
        <p className="profile-picker-label">icon</p>
        <div className="profile-icon-grid">
          {AVATAR_ICONS.map(({ key, icon, label }) => {
            const active = selectedIcon === key
            return (
              <button key={key} onClick={() => setSelectedIcon(key)} title={label}
                className={`profile-icon-btn btn-press${active ? ' profile-icon-btn--active' : ''}`}>
                <FontAwesomeIcon icon={icon} className={`profile-icon${active ? ' profile-icon--active' : ''}`} />
              </button>
            )
          })}
        </div>
        <p className="profile-picker-label">color</p>
        <div className="profile-color-row">
          {AVATAR_COLORS.map(({ hex, label }) => {
            const active = selectedColor === hex
            return (
              <button key={hex} onClick={() => setSelectedColor(hex)} title={label} className="btn-press"
                style={{
                  width: '28px', height: '28px', borderRadius: '50%', background: hex,
                  border: 'none', cursor: 'pointer',
                  boxShadow: active ? `0 0 0 2px var(--bg), 0 0 0 4px ${hex}` : 'none',
                  transition: 'box-shadow 80ms ease',
                }} />
            )
          })}
        </div>
        <button onClick={handleSaveAvatar} disabled={!avatarDirty || savingAvatar}
          className={`profile-save-btn btn-press${avatarDirty ? ' profile-save-btn--dirty' : ''}`}>
          {savedAvatar ? 'Saved' : savingAvatar ? 'Saving…' : 'Save avatar'}
        </button>
      </div>

      {/* Billing */}
      <div className="profile-section">
        {isSubscribed ? (
          <a href={customerPortalUrl} onClick={handleManageBillingClick} className="dashboard-billing-link">
            Manage billing
          </a>
        ) : (
          <div className="dashboard-upsell">
            <p className="dashboard-upsell-title">Unlock the archive</p>
            <p className="dashboard-upsell-body">Play every past day and keep your streaks alive across all games.</p>
            <Link to="/subscribe" className="dashboard-upsell-btn btn-press">See plans</Link>
          </div>
        )}
      </div>

      {/* Legal */}
      <div className="profile-section">
        <p className="profile-section-label">legal</p>
        <Link
          to="/privacy"
          className="btn-hover"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '8px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}
        >
          Privacy Policy →
        </Link>
      </div>

      <div className="profile-signout-section">
        <button onClick={handleSignOut} className="profile-signout-btn">Sign out</button>
      </div>
    </div>
  )
}
