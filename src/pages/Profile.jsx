import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../hooks/useAuth'
import { AVATAR_ICONS, AVATAR_COLORS, saveAvatar, saveProfileSettings, checkUsernameAvailable } from '../lib/avatar'
import { Browser } from '@capacitor/browser'
import { openExternalUrlInApp } from '../lib/inAppBrowser'
import { hapticSelection } from '../lib/haptics'
import { getNativeManageSubscriptionsUrl, usesNativeIap, restorePurchases, requestRefundForActiveEntitlement } from '../lib/billing'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import Avatar from '../components/Avatar'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import './Profile.css'
import './Dashboard.css'

function PreferenceToggle({ label, desc, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
      <div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', marginTop: '2px' }}>{desc}</div>
      </div>
      <button
        type="button"
        onClick={() => { hapticSelection(); onChange(!checked) }}
        aria-pressed={checked}
        style={{
          flexShrink: 0,
          width: '40px',
          height: '22px',
          borderRadius: '11px',
          border: 'none',
          background: checked ? 'var(--amber)' : 'var(--border)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 150ms ease',
          padding: 0,
        }}
      >
        <span style={{
          position: 'absolute',
          top: '3px',
          left: checked ? '21px' : '3px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: '#0f0f0f',
          transition: 'left 150ms ease',
          display: 'block',
        }} />
      </button>
    </div>
  )
}

const VISIBILITY_OPTIONS = [
  { value: 'public',    label: 'Public',         desc: 'Anyone can see your scores on the global leaderboard', premium: true },
  { value: 'followers', label: 'Followers only', desc: 'Only people you follow can see your scores', premium: false },
  { value: 'nobody',    label: 'Private',        desc: 'Your scores never appear on any leaderboard', premium: false },
]

export default function Profile() {
  const { user, profile, loading, signOut, deleteAccount, refreshProfile, markSubscribed } = useAuth()
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

  const [autoplayAudio, setAutoplayAudio] = useState(true)
  const [competitiveMode, setCompetitiveMode] = useState(true)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [savedPrefs, setSavedPrefs] = useState(false)

  const [billingBusy, setBillingBusy] = useState(false)
  const [billingMessage, setBillingMessage] = useState('')

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const synced = useRef(false)

  const onRefresh = useCallback(async () => {
    await refreshProfile()
  }, [refreshProfile])

  const { pullDistance, isRefreshing, isDragging } = usePullToRefresh(onRefresh)

  useEffect(() => {
    if (profile && !synced.current) {
      synced.current = true
      if (profile.avatar_icon) setSelectedIcon(profile.avatar_icon)
      if (profile.avatar_color) setSelectedColor(profile.avatar_color)
      if (profile.username) setUsername(profile.username)
      if (profile.leaderboard_visibility) setVisibility(profile.leaderboard_visibility)
      setAutoplayAudio(profile.autoplay_audio ?? true)
      setCompetitiveMode(profile.competitive_mode ?? true)
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

  const prefsDirty =
    autoplayAudio !== (profile?.autoplay_audio ?? true) ||
    competitiveMode !== (profile?.competitive_mode ?? true)

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

  async function handleSavePrefs() {
    if (!prefsDirty || savingPrefs) return
    setSavingPrefs(true)
    try {
      await saveProfileSettings(user.id, { autoplayAudio, competitiveMode })
      await refreshProfile()
      setSavedPrefs(true)
      setTimeout(() => setSavedPrefs(false), 2000)
    } finally { setSavingPrefs(false) }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true)
    setDeleteError('')
    try {
      await deleteAccount()
      navigate('/')
    } catch (err) {
      setDeleteError(err?.message || 'Something went wrong. Please try again.')
      setDeletingAccount(false)
    }
  }

  async function handleRestorePurchases() {
    if (billingBusy) return
    setBillingBusy(true)
    setBillingMessage('')
    try {
      const restored = await restorePurchases()
      if (restored) {
        await markSubscribed()
        setBillingMessage('Subscription restored!')
      } else {
        setBillingMessage('No active subscription found.')
      }
    } catch (err) {
      setBillingMessage(err?.message || 'Unable to restore purchases.')
    } finally {
      setBillingBusy(false)
    }
  }

  async function handleRequestRefund() {
    if (billingBusy) return
    setBillingBusy(true)
    setBillingMessage('')
    try {
      await requestRefundForActiveEntitlement()
      await refreshProfile()
      setBillingMessage('Refund request submitted.')
    } catch (err) {
      const msg = err?.message || ''
      // AMSErrorDomain Code=6 only occurs in sandbox — refund sheet requires production
      if (msg.includes('Engagement Request Cancelled') || msg.includes('AMSError') || msg.includes('sandbox')) {
        setBillingMessage('Refund requests are only available on the App Store in production, not in sandbox.')
      } else {
        setBillingMessage(msg || 'Unable to start refund request.')
      }
    } finally {
      setBillingBusy(false)
    }
  }

  async function handleCancelSubscription() {
    const url = await getNativeManageSubscriptionsUrl()

    // Refresh subscription status when the browser/App Store page closes.
    // This way a cancellation (or sandbox expiry) is reflected immediately on return.
    let listener = null
    listener = await Browser.addListener('browserFinished', async () => {
      await listener?.remove()
      await refreshProfile()
    })

    await openExternalUrlInApp(url)
  }

  return (
    <div
      className="page-shell-narrow"
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }}
    >
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
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
          <Link to={`/u/${profile.username}`} style={{ fontSize: 'var(--fs-xs)', color: 'var(--amber)', whiteSpace: 'nowrap' }}>
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
              fontSize: 'var(--fs-sm)', outline: 'none',
            }}
          />
          {usernameError && <p style={{ fontSize: 'var(--fs-2xs)', color: '#ef4444', marginTop: '4px' }}>{usernameError}</p>}
          <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-dim)', marginTop: '4px' }}>
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
                onClick={() => { if (locked) return; hapticSelection(); setVisibility(opt.value) }}
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: '8px',
                  border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
                  background: active ? 'var(--amber-glow)' : 'transparent',
                  cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1,
                }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: active ? 'var(--amber)' : 'var(--text-primary)', fontWeight: 500 }}>
                  {opt.label}
                  {opt.premium && !isSubscribed && <span style={{ fontSize: 'var(--fs-2xs)', marginLeft: '6px', color: 'var(--amber)' }}>Premium</span>}
                </div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', marginTop: '2px' }}>{opt.desc}</div>
              </button>
            )
          })}
        </div>

        <button onClick={handleSaveSettings} disabled={!settingsDirty || savingSettings}
          className={`profile-save-btn btn-press${settingsDirty ? ' profile-save-btn--dirty' : ''}`}>
          {savedSettings ? 'Saved' : savingSettings ? 'Saving…' : 'Save profile settings'}
        </button>
      </div>

      {/* Game Preferences */}
      <div className="profile-section">
        <p className="profile-section-label">game preferences</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.25rem' }}>
          <PreferenceToggle
            label="Autoplay audio"
            desc="Song starts playing automatically when a game loads"
            checked={autoplayAudio}
            onChange={setAutoplayAudio}
          />
          <PreferenceToggle
            label="Competitive mode"
            desc="Show the timer and leaderboard during games"
            checked={competitiveMode}
            onChange={setCompetitiveMode}
          />
        </div>

        <button onClick={handleSavePrefs} disabled={!prefsDirty || savingPrefs}
          className={`profile-save-btn btn-press${prefsDirty ? ' profile-save-btn--dirty' : ''}`}>
          {savedPrefs ? 'Saved' : savingPrefs ? 'Saving…' : 'Save preferences'}
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
          <>
            <p className="profile-section-label">subscription</p>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Tempify+ is active.
            </p>
            {usesNativeIap() ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={handleRestorePurchases}
                  disabled={billingBusy}
                  className="profile-billing-btn btn-hover"
                >
                  Restore purchases
                </button>
                <button
                  onClick={handleRequestRefund}
                  disabled={billingBusy}
                  className="profile-billing-btn btn-hover"
                >
                  Request a refund
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={billingBusy}
                  className="profile-billing-btn btn-hover"
                >
                  Cancel subscription →
                </button>
              </div>
            ) : (
              <a
                href={customerPortalUrl}
                onClick={e => { e.preventDefault(); openExternalUrlInApp(customerPortalUrl) }}
                className="profile-billing-btn btn-hover"
                style={{ display: 'inline-block' }}
              >
                Manage billing →
              </a>
            )}
            {billingMessage && (
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '10px' }}>{billingMessage}</p>
            )}
          </>
        ) : (
          <>
            <div className="dashboard-upsell">
              <p className="dashboard-upsell-title">Unlock the archive</p>
              <p className="dashboard-upsell-body">Play every past day and keep your streaks alive across all games.</p>
              <Link to="/subscribe" className="dashboard-upsell-btn btn-press">See plans</Link>
            </div>
            {usesNativeIap() && (
              <button
                onClick={handleRestorePurchases}
                disabled={billingBusy}
                className="profile-billing-btn btn-hover"
                style={{ marginTop: '12px' }}
              >
                {billingBusy ? 'Restoring…' : 'Restore purchases'}
              </button>
            )}
            {billingMessage && (
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '8px' }}>{billingMessage}</p>
            )}
          </>
        )}
      </div>

      {/* Legal */}
      <div className="profile-section">
        <p className="profile-section-label">legal</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
              fontSize: 'var(--fs-xs)',
            }}
          >
            Privacy Policy →
          </Link>
          <Link
            to="/terms"
            className="btn-hover"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontSize: 'var(--fs-xs)',
            }}
          >
            Terms of Service →
          </Link>
        </div>
      </div>

      <div className="profile-signout-section">
        <button onClick={handleSignOut} className="profile-signout-btn">Sign out</button>
      </div>

      <div className="profile-delete-section">
        <p className="profile-section-label">danger zone</p>
        <button
          onClick={() => { setShowDeleteConfirm(true); setDeleteError('') }}
          className="profile-delete-btn"
        >
          Delete account
        </button>
      </div>

      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '24px',
        }}>
          <div style={{
            background: 'var(--bg-card, #1a1a1a)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '24px', maxWidth: '360px', width: '100%',
          }}>
            <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Delete your account?
            </h2>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
              This permanently deletes your account and all your data — scores, streaks, and profile. This cannot be undone.
            </p>
            {deleteError && (
              <p style={{ fontSize: 'var(--fs-xs)', color: '#ef4444', marginBottom: '12px' }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingAccount}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  border: 'none', background: '#ef4444',
                  color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 600,
                  cursor: deletingAccount ? 'not-allowed' : 'pointer',
                  opacity: deletingAccount ? 0.6 : 1,
                }}
              >
                {deletingAccount ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
