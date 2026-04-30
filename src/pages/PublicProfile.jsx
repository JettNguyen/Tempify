import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import {
  followUser, unfollowUser, isFollowing,
  getFollowerProfiles, getFollowingProfiles,
  getRecentScores, getStreaks,
} from '../lib/scores'
import Avatar from '../components/Avatar'
import StreakDisplay from '../components/StreakDisplay'
import './Dashboard.css'
import './PublicProfile.css'

const GAME_NAMES = {
  'one-bar': 'One Bar',
  'hit-or-miss': 'Hit or Miss',
  'sampled': 'Sampled',
  'era': 'Era',
  'cover-or-not': 'Cover or Not',
}

function pct(v) { return `${Math.round(v * 100)}%` }

function fmtTime(s) {
  if (s == null) return null
  if (s < 60) return `${s.toFixed(1)}s`
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null }
function minOf(arr) { return arr.length ? Math.min(...arr) : null }

function buildStats(scores, streaks = []) {
  if (!scores.length) return null

  const wins = scores.filter(s => s.completed)
  const uniqueDays = new Set(scores.map(s => s.date_played)).size
  const longestStreak = streaks.reduce((max, s) => Math.max(max, s.longest_streak || 0), 0)
  const oneTryWins = scores.filter(s => s.completed && s.attempts === 1).length

  // Perfect days — all 5 games won on the same date
  const byDate = {}
  scores.forEach(s => {
    if (!byDate[s.date_played]) byDate[s.date_played] = []
    byDate[s.date_played].push(s)
  })
  const perfectDays = Object.values(byDate).filter(day => {
    const slugs = new Set(day.filter(s => s.completed).map(s => s.game_slug))
    return Object.keys(GAME_NAMES).every(g => slugs.has(g))
  }).length

  // Consistency — % of days since first play that they actually played
  const sortedDates = [...new Set(scores.map(s => s.date_played))].sort()
  const firstPlay = sortedDates[0]
  const today = new Date().toISOString().split('T')[0]
  const totalDaysSinceFirst = firstPlay
    ? Math.max(1, Math.round((new Date(today) - new Date(firstPlay)) / 86400000) + 1)
    : 1
  const consistency = Math.round((uniqueDays / totalDaysSinceFirst) * 100)

  // Per-game stats
  const byGame = Object.keys(GAME_NAMES).map(slug => {
    const plays = scores.filter(s => s.game_slug === slug)
    const w = plays.filter(s => s.completed)
    const allAttempts = plays.map(s => s.attempts).filter(Boolean)
    const winAttempts = w.map(s => s.attempts).filter(Boolean)
    const winTimes = w.filter(s => s.time_seconds != null).map(s => s.time_seconds)
    const allTimes = plays.filter(s => s.time_seconds != null).map(s => s.time_seconds)

    const avgAttempts = avg(allAttempts)
    const bestAttempts = minOf(winAttempts)   // fewest guesses on a win
    const avgTime = avg(allTimes)
    const bestTime = minOf(winTimes)          // fastest winning time
    const oneTryRate = plays.length ? plays.filter(s => s.completed && s.attempts === 1).length / plays.length : 0
    const sub10sRate = winTimes.length ? winTimes.filter(t => t < 10).length / winTimes.length : 0

    return {
      slug, name: GAME_NAMES[slug],
      plays: plays.length, wins: w.length,
      winRate: plays.length ? w.length / plays.length : 0,
      avgAttempts, bestAttempts, avgTime, bestTime,
      oneTryRate, sub10sRate,
    }
  })

  const activeGames = byGame.filter(g => g.plays > 0)
  const bestGame = [...activeGames].sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)[0]

  // Fastest single win across all timed games
  const fastestWin = scores
    .filter(s => s.completed && s.time_seconds != null)
    .reduce((best, s) => (!best || s.time_seconds < best.time) ? { time: s.time_seconds, game: GAME_NAMES[s.game_slug] } : best, null)

  // One Bar mastery — % solved in 1–2 guesses
  const obPlays = scores.filter(s => s.game_slug === 'one-bar')
  const obMastery = obPlays.length
    ? Math.round(obPlays.filter(s => s.completed && s.attempts <= 2).length / obPlays.length * 100)
    : null

  return {
    plays: scores.length, wins: wins.length,
    winRate: scores.length ? wins.length / scores.length : 0,
    uniqueDays, oneTryWins, longestStreak, bestGame,
    perfectDays, consistency, fastestWin, obMastery,
    byGame,
  }
}

export default function PublicProfile() {
  const { username } = useParams()
  const { user, profile: myProfile } = useAuth()

  const [target, setTarget] = useState(null)
  const [scores, setScores] = useState([])
  const [streaks, setStreaks] = useState([])
  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)

  // Followers/following panel
  const [panel, setPanel] = useState(null) // null | 'followers' | 'following'
  const [panelUsers, setPanelUsers] = useState([])
  const [panelLoading, setPanelLoading] = useState(false)

  const isMe = user && target && user.id === target.id
  // For isMe, use AuthContext's profile which has the admin-email override applied
  const isTargetPremium = isMe ? myProfile?.is_subscribed : target?.is_subscribed

  useEffect(() => {
    if (!username) return
    setLoadingProfile(true)
    setPanel(null)

    supabase
      .from('users')
      .select('id, username, avatar_icon, avatar_color, is_subscribed, leaderboard_visibility')
      .eq('username', username.toLowerCase())
      .single()
      .then(async ({ data }) => {
        if (!data) { setTarget(null); setLoadingProfile(false); return }
        setTarget(data)

        const [sc, st, followers, followingIds] = await Promise.all([
          getRecentScores(data.id, 500),
          getStreaks(data.id),
          getFollowerProfiles(data.id),
          getFollowingProfiles(data.id),
        ])
        setScores(sc)
        setStreaks(st)
        setFollowerCount(followers.length)
        setFollowingCount(followingIds.length)

        if (user && user.id !== data.id) {
          const f = await isFollowing(user.id, data.id)
          setFollowing(f)
        }
        setLoadingProfile(false)
      })
  }, [username, user])

  async function openPanel(type) {
    if (panel === type) { setPanel(null); return }
    setPanel(type)
    setPanelLoading(true)
    const profiles = type === 'followers'
      ? await getFollowerProfiles(target.id)
      : await getFollowingProfiles(target.id)
    setPanelUsers(profiles)
    setPanelLoading(false)
  }

  async function handleUnfollow(targetId) {
    if (!user) return
    await unfollowUser(user.id, targetId)
    setPanelUsers(prev => prev.filter(u => u.id !== targetId))
    setFollowingCount(c => c - 1)
  }

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

  const stats = buildStats(scores, streaks)

  return (
    <Shell>
      <Link to="/" className="profile-back">← Home</Link>

      {/* Header */}
      <div className="pubprofile__header">
        <Avatar iconKey={target.avatar_icon} color={target.avatar_color} initial={target.username?.[0]?.toUpperCase() ?? '?'} size={56} />
        <div className="pubprofile__info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h1 className="pubprofile__name">@{target.username}</h1>
            {isTargetPremium && (
              <span style={{
                fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: '#0f0f0f',
                background: 'var(--amber)', borderRadius: '999px',
                padding: '2px 8px', lineHeight: 1.6, flexShrink: 0,
              }}>Premium</span>
            )}
          </div>
          <div className="pubprofile__meta">
            <button className="pubprofile__meta-btn" onClick={() => openPanel('followers')}>
              <strong>{followerCount}</strong> follower{followerCount !== 1 ? 's' : ''}
            </button>
            <span>·</span>
            <button className="pubprofile__meta-btn" onClick={() => openPanel('following')}>
              <strong>{followingCount}</strong> following
            </button>
          </div>
        </div>
        {!isMe && user && (
          <button onClick={handleFollow} disabled={followLoading}
            className={`pubprofile__follow-btn btn-press${following ? ' pubprofile__follow-btn--following' : ''}`}>
            {following ? 'Following' : 'Follow'}
          </button>
        )}
        {isMe && <Link to="/profile" className="pubprofile__follow-btn pubprofile__follow-btn--edit">Edit profile</Link>}
        {!user && <Link to="/login" className="pubprofile__follow-btn">Follow</Link>}
      </div>

      {/* Followers / Following panel */}
      {panel && (
        <div className="pubprofile__panel">
          <p className="pubprofile__panel-title">{panel === 'followers' ? 'Followers' : 'Following'}</p>
          {panelLoading ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</p>
          ) : panelUsers.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {panel === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </p>
          ) : (
            <ul className="pubprofile__panel-list">
              {panelUsers.map(u => (
                <li key={u.id} className="pubprofile__panel-row">
                  <Link to={`/u/${u.username}`} className="pubprofile__panel-user" onClick={() => setPanel(null)}>
                    <Avatar iconKey={u.avatar_icon} color={u.avatar_color} initial={u.username?.[0]?.toUpperCase() ?? '?'} size={28} />
                    <span>@{u.username}</span>
                  </Link>
                  {isMe && panel === 'following' && (
                    <button className="pubprofile__unfollow-btn btn-press" onClick={() => handleUnfollow(u.id)}>
                      Unfollow
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Streaks */}
      <section className="dashboard-section">
        <p className="dashboard-section-label">current streaks</p>
        <StreakDisplay streaks={streaks} />
      </section>

      {/* Stats */}
      <section className="dashboard-section">
        <p className="dashboard-section-label">stats</p>

        {/* Always-visible basics */}
        <div className="dashboard-stat-grid" style={{ marginBottom: '1rem' }}>
          <StatCard label="Win rate"    value={pct(stats?.winRate ?? 0)}  detail={`${stats?.wins ?? 0} of ${stats?.plays ?? 0} played`} />
          <StatCard label="Days played" value={stats?.uniqueDays ?? 0}     detail="Unique puzzle days" />
        </div>

        {!isTargetPremium ? (
          <div className="pubprofile__premium-lock">
            <span className="pubprofile__lock-icon">🔒</span>
            <div>
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '2px' }}>
                Premium stats locked
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Detailed stats are exclusive to premium members.
              </p>
            </div>
          </div>
        ) : !stats ? (
          <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No games played yet.</p>
        ) : (
          <>
            {/* Premium-exclusive stat cards */}
            <p className="pubprofile__premium-label">★ Premium</p>
            <div className="dashboard-stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.25rem' }}>
              <StatCard label="First-try wins"   value={stats.oneTryWins}                         detail="Correct on first guess" highlight={stats.oneTryWins > 0} />
              <StatCard label="Best streak"      value={`${stats.longestStreak}d`}                 detail={stats.bestGame ? `Best in ${stats.bestGame.name}` : 'Keep playing'} highlight={stats.longestStreak >= 7} />
              <StatCard label="Perfect days"     value={stats.perfectDays}                         detail="All 5 games won" highlight={stats.perfectDays > 0} />
              <StatCard label="Consistency"      value={`${stats.consistency}%`}                   detail="Days played since first game" highlight={stats.consistency >= 50} />
              <StatCard label="One Bar mastery"  value={stats.obMastery != null ? `${stats.obMastery}%` : '—'} detail="Solved in ≤2 guesses" highlight={stats.obMastery >= 50} />
              <StatCard label="Speed record"     value={stats.fastestWin ? fmtTime(stats.fastestWin.time) : '—'} detail={stats.fastestWin ? `in ${stats.fastestWin.game}` : 'No timed wins yet'} highlight={!!stats.fastestWin} />
            </div>

            {/* Per-game breakdown */}
            <div className="dashboard-game-stats">
              {stats.byGame.filter(g => g.plays > 0).map(game => {
                const isOneBar = game.slug === 'one-bar'
                return (
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
                      {isOneBar ? (
                        <span>
                          {game.avgAttempts != null ? `${game.avgAttempts.toFixed(1)} avg · ` : ''}
                          {game.bestAttempts != null ? `best ${game.bestAttempts} · ` : ''}
                          {`${Math.round(game.oneTryRate * 100)}% first-try`}
                        </span>
                      ) : (
                        <span>
                          {game.avgTime != null ? `avg ${fmtTime(game.avgTime)}` : ''}
                          {game.bestTime != null ? ` · best ${fmtTime(game.bestTime)}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* Recent plays */}
      {isTargetPremium && scores.length > 0 && (
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

function Shell({ children }) { return <div className="page-shell-wide">{children}</div> }

function StatCard({ label, value, detail, highlight }) {
  return (
    <div className="dashboard-stat-card">
      <p className="dashboard-stat-card__label">{label}</p>
      <p className={"dashboard-stat-card__value" + (highlight ? ' dashboard-stat-card__value--highlight' : '')}>
        {value}
      </p>
      <p className="dashboard-stat-card__detail">{detail}</p>
    </div>
  )
}
