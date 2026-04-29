import { useState, useEffect, useRef } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../hooks/useAuth'
import { AVATAR_ICONS, AVATAR_COLORS, saveAvatar } from '../lib/avatar'
import Avatar from '../components/Avatar'
import './Profile.css'

export default function Profile() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [selectedIcon, setSelectedIcon] = useState(null)
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0].hex)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const synced = useRef(false)

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
    <div className="page-shell-narrow">
      <Link to="/dashboard" className="profile-back">← Dashboard</Link>

      <div className="profile-header">
        <Avatar
          iconKey={selectedIcon}
          color={selectedColor}
          initial={initial}
          size={64}
        />
        <div>
          <div className="profile-email">{profile?.email || user.email}</div>
          <span className={`profile-badge${isSubscribed ? ' profile-badge--subscribed' : ''}`}>
            {isSubscribed ? 'Subscribed' : 'Free plan'}
          </span>
        </div>
      </div>

      <div className="profile-section">
        <p className="profile-section-label">your avatar</p>

        <p className="profile-picker-label">icon</p>
        <div className="profile-icon-grid">
          {AVATAR_ICONS.map(({ key, icon, label }) => {
            const active = selectedIcon === key
            return (
              <button
                key={key}
                onClick={() => setSelectedIcon(key)}
                title={label}
                className={`profile-icon-btn btn-press${active ? ' profile-icon-btn--active' : ''}`}
              >
                <FontAwesomeIcon
                  icon={icon}
                  className={`profile-icon${active ? ' profile-icon--active' : ''}`}
                />
              </button>
            )
          })}
        </div>

        <p className="profile-picker-label">color</p>
        <div className="profile-color-row">
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
                  boxShadow: active ? `0 0 0 2px var(--bg), 0 0 0 4px ${hex}` : 'none',
                  transition: 'box-shadow 80ms ease',
                }}
              />
            )
          })}
        </div>

        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={`profile-save-btn btn-press${isDirty ? ' profile-save-btn--dirty' : ''}`}
        >
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div className="profile-signout-section">
        <button onClick={handleSignOut} className="profile-signout-btn">
          Sign out
        </button>
      </div>
    </div>
  )
}
