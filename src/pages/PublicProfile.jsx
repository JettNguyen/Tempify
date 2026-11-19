import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import {
  followUser, unfollowUser, isFollowing,
  getFollowerProfiles, getFollowingProfiles,
  getAllScores, getStreaks,
} from '../lib/scores'
import { GAME_SLUGS } from '../lib/games'
import { todayEST } from '../lib/date'
import { getCoverPuzzles } from '../lib/puzzles'
import { profileStats, coverDatesToCheck } from '../lib/profileStats'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import Avatar from '../components/Avatar'
import DelayedSpinner from '../components/DelayedSpinner'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import ProfileStats from '../components/ProfileStats'
import './PublicProfile.css'

// Each game's streak can be frozen twice a month with Tempify+.
const FREEZES_PER_GAME = 2

export default function PublicProfile() {
  const { username } = useParams()
  const { user, profile: myProfile } = useAuth()

  const [target, setTarget] = useState(null)
  const [scores, setScores] = useState([])
  const [streaks, setStreaks] = useState([])
  // Cover or Not's puzzles for the days played, to tell a cover's 2,000 from
  // an original's 1,000.
  const [coverPuzzles, setCoverPuzzles] = useState({})
  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [freezesUsed, setFreezesUsed] = useState(0)

  // Followers/following panel
  const [panel, setPanel] = useState(null) // null | 'followers' | 'following'
  const [panelUsers, setPanelUsers] = useState([])
  const [panelLoading, setPanelLoading] = useState(false)

  const isMe = user && target && user.id === target.id
  // For isMe, use AuthContext's profile which applies premium-email overrides.
  const isTargetPremium = isMe ? myProfile?.is_subscribed : target?.is_subscribed

  const fetchProfile = useCallback(async () => {
    if (!username) return
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_icon, avatar_color, is_subscribed, leaderboard_visibility')
      .eq('username', username.toLowerCase())
      .maybeSingle()
    if (error || !data) { setTarget(null); return }
    setTarget(data)

    const [sc, st, followers, followingIds] = await Promise.all([
      getAllScores(data.id),
      getStreaks(data.id),
      getFollowerProfiles(data.id),
      getFollowingProfiles(data.id),
    ])
    setScores(sc)
    setStreaks(st)
    setCoverPuzzles(await getCoverPuzzles(coverDatesToCheck(sc)))
    setFollowerCount(followers.length)
    setFollowingCount(followingIds.length)

    if (user && user.id !== data.id) {
      const f = await isFollowing(user.id, data.id)
      setFollowing(f)
    }
  }, [username, user])

  const fetchFreezes = useCallback(async () => {
    if (!user || !myProfile?.is_subscribed) return
    const { data } = await supabase
      .from('streak_freezes')
      .select('tokens_used')
      .eq('user_id', user.id)
      .eq('month', todayEST().slice(0, 7))
    setFreezesUsed((data || []).reduce((sum, r) => sum + r.tokens_used, 0))
  }, [user, myProfile?.is_subscribed])

  useEffect(() => {
    setLoadingProfile(true)
    setPanel(null)
    Promise.all([fetchProfile(), fetchFreezes()]).finally(() => setLoadingProfile(false))
  }, [fetchProfile, fetchFreezes])

  const onRefresh = useCallback(async () => {
    await Promise.all([fetchProfile(), fetchFreezes()])
  }, [fetchProfile, fetchFreezes])

  const { pullDistance, isRefreshing, isDragging } = usePullToRefresh(onRefresh)

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

  if (loadingProfile) return <Shell><DelayedSpinner active={loadingProfile} label="Loading profile..." /></Shell>
  if (!target) return (
    <Shell>
      <p className="pubprofile__missing">No one has that username.</p>
      <Link to="/" className="profile-back">← Home</Link>
    </Shell>
  )

  const stats = profileStats(scores, streaks, coverPuzzles)
  // A Tempify+ player's own page says how many streak freezes are left.
  const freezesLeft = isMe && isTargetPremium ? Math.max(0, GAME_SLUGS.length * FREEZES_PER_GAME - freezesUsed) : null

  return (
    <Shell pullDistance={pullDistance} isRefreshing={isRefreshing} isDragging={isDragging}>
      <Link to="/" className="profile-back">← Home</Link>

      <div className="pubprofile__header">
        <Avatar iconKey={target.avatar_icon} color={target.avatar_color} initial={target.username?.[0]?.toUpperCase() ?? '?'} size={56} />
        <div className="pubprofile__info">
          <div className="pubprofile__name-row">
            <h1 className="pubprofile__name">@{target.username}</h1>
            {isTargetPremium && <span className="pubprofile__badge">Premium</span>}
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
        {isMe && <Link to="/profile" className="pubprofile__follow-btn pubprofile__follow-btn--edit btn-press">Edit profile</Link>}
        {!user && <Link to="/login" className="pubprofile__follow-btn btn-press">Follow</Link>}
      </div>

      {panel && (
        <div className="pubprofile__panel">
          <p className="pubprofile__panel-title">{panel === 'followers' ? 'Followers' : 'Following'}</p>
          {panelLoading ? (
            <DelayedSpinner active={panelLoading} inline label="Loading..." />
          ) : panelUsers.length === 0 ? (
            <p className="pubprofile__panel-empty">
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

      <ProfileStats
        stats={stats}
        streaks={streaks}
        isMe={Boolean(isMe)}
        full={Boolean(isTargetPremium)}
        username={target.username}
        freezesLeft={freezesLeft}
      />
    </Shell>
  )
}

function Shell({ children, pullDistance = 0, isRefreshing = false, isDragging = false }) {
  return (
    <div
      className="page-shell-wide"
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }}
    >
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      {children}
    </div>
  )
}
