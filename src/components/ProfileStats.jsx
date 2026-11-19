import { Link } from 'react-router-dom'
import StreakDisplay from './StreakDisplay'
import { fmtPoints } from '../lib/points'
import { getGameName } from '../lib/games'
import { todayEST, yesterdayEST, fmtDayShort, fmtDayNumber, fmtMonthDayYear } from '../lib/date'
import './ProfileStats.css'

// A profile's stats, in points like the games: the totals first, then
// streaks, then each game measured the same way, then the latest days.

const pct = (share) => `${Math.round(share * 100)}%`

function dayName(date) {
  if (date === todayEST()) return 'Today'
  if (date === yesterdayEST()) return 'Yesterday'
  return fmtDayShort(date)
}

function Tile({ label, value, detail, accent }) {
  return (
    <div className="pstats-tile">
      <p className="pstats-tile__label">{label}</p>
      <p className={`pstats-tile__value${accent ? ' pstats-tile__value--accent' : ''}`}>{value}</p>
      {detail && <p className="pstats-tile__detail">{detail}</p>}
    </div>
  )
}

function LockIcon() {
  return (
    <svg className="pstats-lock__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

/**
 * `stats` from profileStats, null before the first play. `full` is whether
 * the player has Tempify+, which shows everything past the first two numbers.
 */
export default function ProfileStats({ stats, streaks, isMe, full, username, freezesLeft }) {
  return (
    <>
      <section className="pstats-section">
        <h2 className="pstats-label">points</h2>
        {!stats ? (
          <p className="pstats-empty">
            {isMe ? <>No games played yet. <Link to="/">Play today's games</Link> and your points show up here.</> : 'No games played yet.'}
          </p>
        ) : (
          <div className="pstats-tiles">
            <Tile label="All time" value={fmtPoints(stats.total)} accent />
            <Tile label="Days played" value={stats.daysPlayed.toLocaleString('en-US')} />
            {full && stats.bestDay && (
              <Tile label="Best day" value={fmtPoints(stats.bestDay.points)} detail={fmtMonthDayYear(stats.bestDay.date)} />
            )}
            {full && (
              <Tile
                label="Best streak"
                value={stats.bestStreak ? `${stats.bestStreak.days} day${stats.bestStreak.days === 1 ? '' : 's'}` : '0 days'}
                detail={stats.bestStreak ? `in ${getGameName(stats.bestStreak.slug)}` : null}
              />
            )}
          </div>
        )}
      </section>

      <section className="pstats-section">
        <div className="pstats-label-row">
          <h2 className="pstats-label">current streaks</h2>
          {freezesLeft != null && (
            <span className={`pstats-freezes${freezesLeft ? '' : ' pstats-freezes--none'}`}>
              {freezesLeft} streak freeze{freezesLeft === 1 ? '' : 's'} left this month
            </span>
          )}
        </div>
        <StreakDisplay streaks={streaks} />
      </section>

      {stats && !full && (
        <section className="pstats-section">
          <div className="pstats-lock">
            <LockIcon />
            <div className="pstats-lock__text">
              <p className="pstats-lock__title">
                {isMe ? 'See more with Tempify+' : `More of @${username}'s stats come with Tempify+`}
              </p>
              <p className="pstats-lock__body">
                {isMe
                  ? 'Your best day, how you do in each game, and your last week of days.'
                  : 'Their best day, how they do in each game, and their last week of days.'}
              </p>
            </div>
            {isMe && <Link to="/subscribe" className="pstats-lock__btn btn-press">Get Tempify+</Link>}
          </div>
        </section>
      )}

      {stats && full && (
        <section className="pstats-section">
          <h2 className="pstats-label">by game</h2>
          <p className="pstats-caption">
            How much of each game's points {isMe ? 'you get' : 'they get'}, on average.
          </p>
          <ul className="pstats-list">
            {stats.byGame.map(game => (
              <li key={game.slug} className={`pstats-game game-theme--${game.slug}`}>
                <div className="pstats-game__top">
                  <span className="pstats-game__name">{game.name}</span>
                  <span className="pstats-game__share">{pct(game.share)}</span>
                </div>
                <div className="pstats-game__bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(game.share * 100, game.share > 0 ? 2 : 0)}%` }} />
                </div>
                <p className="pstats-game__meta">
                  {game.days} {game.days === 1 ? 'day' : 'days'} · avg {fmtPoints(game.avgPoints)} · best {fmtPoints(game.bestPoints)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats && full && (
        <section className="pstats-section">
          <h2 className="pstats-label">recent days</h2>
          <ul className="pstats-list">
            {stats.recentDays.map(day => {
              const played = new Set(day.slugs)
              const playedCount = day.lineup.filter(slug => played.has(slug)).length
              return (
                <li key={day.date} className="pstats-day">
                  <div className="pstats-day__when">
                    <span className="pstats-day__date">{dayName(day.date)}</span>
                    <span className="pstats-day__games">
                      <span className="pstats-day__dots" aria-hidden="true">
                        {day.lineup.map(slug => (
                          <span key={slug} className={`pstats-day__dot game-theme--${slug}${played.has(slug) ? ' pstats-day__dot--played' : ''}`} />
                        ))}
                      </span>
                      {[fmtDayNumber(day.date), playedCount === day.lineup.length ? `all ${day.lineup.length} games` : `${playedCount} of ${day.lineup.length} games`].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <span className="pstats-day__points">
                    {fmtPoints(day.points)}<span className="pstats-day__unit"> pts</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}
