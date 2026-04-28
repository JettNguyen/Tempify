import { useState, useEffect, useRef } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../hooks/useAuth'
import { AVATAR_ICONS, AVATAR_COLORS, saveAvatar } from '../lib/avatar'
import Avatar from '../components/Avatar'

export default function Profile() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [selectedIcon, setSelectedIcon] = useState(null)
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0].hex)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const synced = useRef(false)

  // Populate picker with saved avatar once profile is available
  useEffect(() => {
    if (profile && !synced.current) {
      synced.current = true
      if (profile.avatar_icon) setSelectedIcon(profile.avatar_icon)
      if (profile.avatar_color) setSelectedColor(profile.avatar_color)
    }
  }, [profile])

  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: '/profile' }} replace />

  const initial = (profile?.email || user.email || '').split('@')[0][0]?.toUpperCase() ?? '?'
  const isSubscribed = profile?.is_subscribed

  const isDirty =
    selectedIcon !== (profile?.avatar_icon ?? null) ||
    selectedColor !== (profile?.avatar_color ?? AVATAR_COLORS[0].hex)

  async function handleSave() {
    if (!isDirty || saving) return
    setSaving(true)
    try {
      await saveAvatar(user.id, { icon: selectedIcon, color: selectedColor })
      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '88px 1.25rem 4rem' }}>

      {/* Back link */}
      <Link
        to="/dashboard"
        style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'inline-block', marginBottom: '2rem' }}
      >
        ← Dashboard
      </Link>

      {/* Header: avatar + account info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <Avatar
          iconKey={selectedIcon}
          color={selectedColor}
          initial={initial}
          size={64}
        />
        <div>
          <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            {profile?.email || user.email}
          </div>
          <span style={{
            fontSize: '11px',
            fontWeight: 500,
            padding: '3px 8px',
            borderRadius: '999px',
            background: isSubscribed ? 'var(--amber-glow)' : 'transparent',
            border: `1px solid ${isSubscribed ? 'var(--amber)' : 'var(--border)'}`,
            color: isSubscribed ? 'var(--amber)' : 'var(--text-dim)',
          }}>
            {isSubscribed ? 'Subscribed' : 'Free plan'}
          </span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem', marginBottom: '2rem' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          your avatar
        </p>

        {/* Icon picker */}
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>icon</p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '8px',
          marginBottom: '1.5rem',
        }}>
          {AVATAR_ICONS.map(({ key, icon, label }) => {
            const active = selectedIcon === key
            return (
              <button
                key={key}
                onClick={() => setSelectedIcon(key)}
                title={label}
                className="btn-press"
                style={{
                  aspectRatio: '1',
                  borderRadius: '10px',
                  background: active ? 'var(--amber-glow)' : 'var(--surface)',
                  border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 80ms ease, border-color 80ms ease',
                }}
                onMouseEnter={(e) => !active && (e.currentTarget.style.background = '#222222')}
                onMouseLeave={(e) => !active && (e.currentTarget.style.background = 'var(--surface)')}
              >
                <FontAwesomeIcon
                  icon={icon}
                  style={{
                    fontSize: '16px',
                    color: active ? 'var(--amber)' : 'var(--text-muted)',
                  }}
                />
              </button>
            )
          })}
        </div>

        {/* Color picker */}
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>color</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
          {AVATAR_COLORS.map(({ hex, label }) => {
            const active = selectedColor === hex
            return (
              <button
                key={hex}
                onClick={() => setSelectedColor(hex)}
                title={label}
                className="btn-press"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: hex,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: active
                    ? `0 0 0 2px var(--bg), 0 0 0 4px ${hex}`
                    : 'none',
                  transition: 'box-shadow 80ms ease',
                }}
              />
            )
          })}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="btn-press"
          style={{
            padding: '8px 20px',
            borderRadius: '999px',
            border: `1px solid ${isDirty ? 'var(--amber)' : 'var(--border)'}`,
            background: isDirty ? 'var(--amber)' : 'transparent',
            color: isDirty ? '#0f0f0f' : 'var(--text-dim)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: isDirty ? 'pointer' : 'default',
            transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
          }}
        >
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* Sign out */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
        <button
          onClick={handleSignOut}
          style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
