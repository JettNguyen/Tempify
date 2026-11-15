import { useRef, useState } from 'react'
import Icon from './Icon'
import './ChartBar.css'

/** The position (0 at the top of the track, 1 at the bottom) a point on it stands for. */
export function positionAt(clientY, top, height, steps) {
  if (!height) return 0
  const p = (clientY - top) / height
  return Math.min(1, Math.max(0, Math.round(p * steps) / steps))
}

/**
 * Hit or Miss's answer: a chart bar you push up to where the song peaked, #1
 * at the top and "never charted" in the basement under #100. Higher on the
 * chart is higher on the screen, so there's nothing to learn. Once it's locked
 * in, the real peak rises in the lane beside yours, in green, amber or red for
 * how close you were, with the distance between the two shaded across both.
 *
 * Drag anywhere on the track, or tap a spot to jump there. The arrows beside
 * the number move one place at a time, for the last bit of aim.
 *
 * @param position  where your bar's top sits, 0 (top of the track) to 1
 * @param steps     how finely a drag lands, in stops along the track
 * @param onMove    called with a new position
 * @param onStep    called with how many places to move, negative for higher,
 *                  from the arrows and the keyboard
 * @param answerAt  where the real answer sits, 0 to 1, once revealed
 * @param tier      close | near | far once revealed, null before
 * @param floor     where the chart ends and the basement starts, 0 to 1
 * @param ticks     marks beside the track: { at, label, zone }
 * @param value     the big readout, and sub the line under it
 * @param children  under the readout: the lock-in button, or the outcome
 */
export default function ChartBar({
  position, steps, onMove, onStep, answerAt, tier, locking, floor = 1, ticks = [],
  value, sub, label, valueText, lanes = ['You', 'Peak'], children,
}) {
  const trackRef = useRef(null)
  const dragRef = useRef(null)
  const [touched, setTouched] = useState(false)
  const revealed = tier != null
  const disabled = revealed || locking
  const inBasement = position > floor
  const answerInBasement = answerAt != null && answerAt > floor

  function moveTo(clientY) {
    const box = trackRef.current.getBoundingClientRect()
    setTouched(true)
    onMove(positionAt(clientY, box.top, box.height, steps))
  }

  function down(e) {
    if (disabled) return
    e.preventDefault()
    trackRef.current.setPointerCapture?.(e.pointerId)
    dragRef.current = e.pointerId
    trackRef.current.focus({ preventScroll: true })
    moveTo(e.clientY)
  }

  function drag(e) {
    if (dragRef.current === e.pointerId) moveTo(e.clientY)
  }

  function up(e) {
    if (dragRef.current === e.pointerId) dragRef.current = null
  }

  function step(places) {
    setTouched(true)
    if (onStep) onStep(places)
    else onMove(Math.min(1, Math.max(0, position + places / steps)))
  }

  function key(e) {
    if (disabled) return
    const moves = { ArrowUp: -1, ArrowRight: -1, ArrowDown: 1, ArrowLeft: 1 }
    if (e.key in moves) {
      e.preventDefault()
      step(moves[e.key])
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      step(e.key === 'PageUp' ? -10 : 10)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setTouched(true)
      onMove(e.key === 'Home' ? 0 : 1)
    }
  }

  const classes = [
    'chart-bar',
    revealed && `chart-bar--revealed chart-bar--${tier}`,
    locking && 'chart-bar--locking',
    !touched && !disabled && 'chart-bar--idle',
    inBasement && 'chart-bar--never',
    answerInBasement && 'chart-bar--answer-never',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      style={{ '--guess': position, '--actual': answerAt ?? position, '--floor': floor }}
    >
      <div className="chart-bar__scale">
        <div className="chart-bar__ticks" aria-hidden="true">
          {ticks.map(t => (
            <span key={t.label} className={t.zone ? 'chart-bar__tick-zone' : undefined} style={{ '--at': t.at }}>{t.label}</span>
          ))}
        </div>

        <div className="chart-bar__column">
          <div
            ref={trackRef}
            className="chart-bar__track"
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-orientation="vertical"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={steps}
            aria-valuenow={Math.round((1 - position) * steps)}
            aria-valuetext={valueText}
            aria-disabled={disabled || undefined}
            onPointerDown={down}
            onPointerMove={drag}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={key}
          >
            {ticks.filter(t => !t.zone).map(t => (
              <span key={t.label} className="chart-bar__line" style={{ '--at': t.at }} aria-hidden="true" />
            ))}
            <span className="chart-bar__basement" aria-hidden="true" />

            <span className="chart-bar__lane chart-bar__lane--you" aria-hidden="true">
              <span className="chart-bar__fill" />
              <span className="chart-bar__handle"><span /><span /><span /></span>
            </span>

            <span className="chart-bar__lane chart-bar__lane--real" aria-hidden="true">
              {revealed
                ? <span key="real" className="chart-bar__real" />
                : <span className="chart-bar__mystery">?</span>}
            </span>

            {revealed && <span className="chart-bar__gap" aria-hidden="true" />}
          </div>

          <div className="chart-bar__lane-labels" aria-hidden="true">
            <span>{lanes[0]}</span>
            <span>{lanes[1]}</span>
          </div>
        </div>
      </div>

      <div className="chart-bar__side">
        <div className="chart-bar__readout" aria-live="polite">
          <span key={revealed ? 'answer' : 'guess'} className="chart-bar__value">{value}</span>
          {sub && <span className="chart-bar__sub">{sub}</span>}
        </div>

        {!revealed && (
          <div className="chart-bar__nudge">
            <button type="button" className="chart-bar__nudge-btn btn-press" onClick={() => step(-1)} disabled={disabled} aria-label="One place higher">
              <Icon name="chevronUp" size={18} strokeWidth={2.5} />
            </button>
            <button type="button" className="chart-bar__nudge-btn btn-press" onClick={() => step(1)} disabled={disabled} aria-label="One place lower">
              <Icon name="chevronDown" size={18} strokeWidth={2.5} />
            </button>
          </div>
        )}

        <div className="chart-bar__actions">{children}</div>
      </div>
    </div>
  )
}
