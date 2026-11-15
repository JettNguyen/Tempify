import { useRef } from 'react'
import { useFitScreen } from '../hooks/useFitScreen'

/**
 * The page a game is played on, in its own colours. `fill` stretches it to the
 * screen on a phone so the stage takes the spare height (globals.css); One Bar
 * leaves it off, since its field raises the keyboard. Every game screen folds
 * itself to fit the screen as it grows (useFitScreen).
 */
export default function GameScreen({ slug, fill = true, className, children }) {
  const ref = useRef(null)
  useFitScreen(ref)
  const classes = [
    'page-shell',
    fill && 'page-shell--fill',
    'page-shell--game',
    `game-theme--${slug}`,
    className,
  ].filter(Boolean).join(' ')
  return <div ref={ref} className={classes}>{children}</div>
}
