import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { followUser, unfollowUser, isFollowing, getFollowing, getFollowers, getRecentScores, getStreaks } from '../lib/scores'
import Avatar from '../components/Avatar'
import StreakDisplay from '../components/StreakDisplay'
import './Dashboard.css'
import './PublicProfile.css'

const GAME_NAMES = {
  'one-bar': 'One Bar',
  'drop-or-flop': 'Hit or Miss',
  'who-sampled-it': 'Sampled',
  'era': 'Era',
  'cover-or-not': 'Cover or Not',
}

function pct(v) { return `${Math.round(v * 100)}%` }

function buildStats(scores) {
  const wins = scores.filter(s => s.completed)
  const byGame = Object.keys(GAME_NAMES).map(slug => {
    const plays = scores.filter(s => s.game_slug === slug)
    const w = plays.filter(s => s.completed)
    return {
      slug, name: GAME_NAMES[slug],
      plays: plays.length, wins: w.length,
      winRate: plays.length ? w.length / plays.length : 0,
    }
  })
  return {
    plays: scores.length,
    wins: wins.length,
    winRate: scores.length ? wins.length / scores.length : 0,
    uniqueDays: new Set(scores.map(s => s.date_played)).size,
    byGame,
  }
}

export default function PublicProfile() {
  const { username } = useParams()
  const { user, profile: myProfile } = useAuth()

  const [target, setTarget] = useState(null)       // the profile being viewed
  const [scores, setScores] = useState([])
  const [streaks, setStreaks] = useState([])
  const [following, setFollowing] = useState(false) // am I following them?
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)

  const isMe = user && target && user.id === target.id
  const isTargetPremium = target?.is_subscribed
  const canSeeFullStats = isTargetPremium

  useEffect(() => {
    if (!username) return
    setLoadingProfile(true)

    supabase
      .from('users')
      .select('id, username, avatar_icon, avatar_color, is_subscribed, leaderboard_visibility')
      .eq('username', username.toLowerCase())
      .single()
      .then(async ({ data }) => {
        if (!data) { setTarget(null); setLoadingProfile(false); return }
        setTarget(data)

        const [scores, streaks, followers, followingIds] = await Promise.all([
          getRecentScores(data.id, 500),
          getStreaks(data.id),
          getFollowers(data.id),
          getFollowing(data.id),
        ])
        setScores(scores)
        setStreaks(streaks)
        setFollowerCount(followers.length)
        setFollowingCount(followingIds.length)

        if (user && user.id !== data.id) {
          const f = await isFollowing(user.id, data.id)
          setFollowing(f)
        }

        setLoadingProfile(false)
      })
  }, [username, user])

  async function handleFollow() {
    if (!user || !target || followLoading) return
    setFollowLoading(true)
    if (following) {
      await unfollowUser(user.id, target.id)
      setFollowing(false)
      setFollowerCount(c => c - 1)
    } else {
      await followUser(user.id, target.id)
      setFollowing(true)
      setFollowerCount(c => c + 1)
    }
    setFollowLoading(false)
  }

  if (loadingProfile) return <Shell><p style={{ color: 'var(--text-muted)' }}>Loading…</p></Shell>
  if (!target) return (
    <Shell>
      <p style={{ color: 'var(--text-muted)' }}>User not found.</p>
      <Link to="/" style={{ color: 'var(--amber)', fontSize: '13px' }}>← Home</Link>
    </Shell>
  )

  const stats = buildStats(scores)

  return (
    <Shell>
      <Link to="/" className="profile-back">← Home</Link>

      {/* Header */}
      <div className="pubprofile__header">
        <Avatar
          iconKey={target.avatar_icon}
          color={target.avatar_color}
          initial={target.username?.[0]?.toUpperCase() ?? '?'}
          size={56}
        />
        <div className="pubprofile__info">
          <h1 className="pubprofile__name">@{target.username}</h1>
          <div className="pubprofile__meta">
            <span>{followerCount} follower{followerCount !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{followingCount} following</span>
          </div>
        </div>
        {!isMe && user && (
          <button
            onClick={handleFollow}
            disabled={followLoading}
            className={`pubprofile__follow-btn btn-press${following ? ' pubprofile__follow-btn--following' : ''}`}
          >
            {following ? 'Following' : 'Follow'}
          </button>
        )}
        {isMe && (
          <Link to="/profile" className="pubprofile__follow-btn pubprofile__follow-btn--edit">Edit profile</Link>
        )}
        {!user && (
          <Link to="/login" className="pubprofile__follow-btn">Follow</Link>
        )}
      </div>

      {/* Streaks — always visible */}
      <section className="dashboard-section">
        <p className="dashboard-section-label">current streaks</p>
        <StreakDisplay streaks={streaks} />
      </section>

      {/* Stats */}
      <section className="dashboard-section">
        <p className="dashboard-section-label">stats</p>
        {!canSeeFullStats ? (
          <div className="pubprofile__locked">
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Win rate: <strong style={{ color: 'var(--text-primary)' }}>{pct(stats.winRate)}</strong>
              {'  '}·{'  '}
              Games played: <strong style={{ color: 'var(--text-primary)' }}>{stats.plays}</strong>
            </p>
            {!isTargetPremium && (
              <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                Detailed stats are only visible for premium members.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="dashboard-stat-grid">
              <StatCard label="Win rate" value={pct(stats.winRate)} detail={`${stats.wins}/${stats.plays} won`} />
              <StatCard label="Days played" value={stats.uniqueDays} detail="Unique days" />
            </div>
            <div className="dashboard-game-stats">
              {stats.byGame.filter(g => g.plays > 0).map(game => (
                <div key={game.slug} className="dashboard-game-stat">
                  <div className="dashboard-game-stat__top">
                    <span>{game.name}</span>
                    <strong>{pct(game.winRate)}</strong>
                  </div>
                  <div className="dashboard-game-stat__bar">
                    <span style={{ width: `${game.winRate * 100}%` }} />
                  </div>
                  <div className="dashboard-game-stat__meta">
                    <span>{game.wins}/{game.plays} wins</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Recent plays — only show if premium profile */}
      {canSeeFullStats && scores.length > 0 && (
        <section className="dashboard-section">
          <p className="dashboard-section-label">recent plays</p>
          <div>
            {scores.slice(0, 10).map(score => (
              <div key={score.id} className="dashboard-score-row">
                <div className="dashboard-score-left">
                  <span className={`dashboard-score-dot${score.completed ? ' dashboard-score-dot--complete' : ''}`} />
                  <div>
                    <div className="dashboard-score-name">{GAME_NAMES[score.game_slug] || score.game_slug}</div>
                    <div className="dashboard-score-date">{score.date_played}</div>
                  </div>
                </div>
                <span className={`dashboard-score-result${score.completed ? ' dashboard-score-result--win' : ''}`}>
                  {score.completed ? 'Win' : 'Loss'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </Shell>
  )
}

function Shell({ children }) {
  return <div className="page-shell-wide">{children}</div>
}

function StatCard({ label, value, detail }) {
  return (
    <div className="dashboard-stat-card">
      <p className="dashboard-stat-card__label">{label}</p>
      <p className="dashboard-stat-card__value">{value}</p>
      <p className="dashboard-stat-card__detail">{detail}</p>
    </div>
  )
}
