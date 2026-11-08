import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getCustomGame, customPuzzle, customKey, customTitle, makerTag, isCustomCode } from '../lib/customGames'
import { GAME_BY_SLUG } from '../lib/games'
import { hapticSelection } from '../lib/haptics'
import DelayedSpinner from '../components/DelayedSpinner'
import './CustomGame.css'

/**
 * Opens a game a player made (?c=<code>) and hands its songs to the screen
 * the daily game uses. `children(puzzle, custom)` draws that screen; `custom`
 * tells it to keep the play out of streaks, scores and the daily counts, and
 * carries who made it.
 */
export default function CustomGame({ code, slug, Shell, children }) {
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const [game, setGame] = useState(null)
  const [state, setState] = useState(isCustomCode(code) ? 'loading' : 'missing')
  const [tries, setTries] = useState(0)

  useEffect(() => {
    if (!isCustomCode(code)) return
    let cancelled = false
    setState('loading')
    getCustomGame(code)
      .then((found) => {
        if (cancelled) return
        setGame(found)
        setState(found ? 'ready' : 'missing')
      })
      .catch(() => { if (!cancelled) setState('failed') })
    return () => { cancelled = true }
  }, [code, tries])

  // The player's own record is kept per account, so wait to know whose it is.
  if (state === 'loading' || (state === 'ready' && authLoading)) {
    return <Shell><DelayedSpinner active label="Loading game..." /></Shell>
  }

  if (state === 'failed') {
    return (
      <Shell>
        <div className="custom-missing">
          <p className="custom-missing__title">Couldn't load this game</p>
          <p className="custom-missing__body">Check your connection and try again.</p>
          <button
            type="button"
            className="custom-missing__action btn-press"
            onClick={() => { hapticSelection(); setTries(n => n + 1) }}
          >
            Try again
          </button>
        </div>
      </Shell>
    )
  }

  if (state === 'missing') {
    return (
      <Shell>
        <div className="custom-missing">
          <p className="custom-missing__title">This game isn't here anymore</p>
          <p className="custom-missing__body">
            Whoever made it may have deleted it, or the link was cut short. Ask them to send it again.
          </p>
          <Link to="/" replace className="custom-missing__action btn-press">Play today's games</Link>
        </div>
      </Shell>
    )
  }

  // A link pasted onto the wrong game's page still opens the right game.
  if (game.slug !== slug && GAME_BY_SLUG[game.slug]) {
    return <Navigate to={`${GAME_BY_SLUG[game.slug].path}?${searchParams}`} replace />
  }

  const mine = Boolean(user && user.id === game.makerId)
  const custom = {
    ...game,
    mine,
    key: customKey(game.code),
    title: customTitle({ maker: game.maker, mine, slug: game.slug }),
    tag: makerTag({ maker: game.maker, mine }),
    // The maker came from their list of games; anyone else, from a link.
    back: mine ? '/make' : '/',
  }
  return children(customPuzzle(game), custom)
}
