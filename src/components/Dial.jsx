import './Dial.css'

/**
 * Drag to an answer and lock it in; once it's revealed, the real answer drops
 * onto the same rail. Hit or Miss's peaks and Cover or Not's years.
 *
 * @param position  where the thumb sits, 0 to 1
 * @param steps     how many stops the rail has, so an arrow key moves one
 *                  (one year, say) rather than a thousandth of the rail
 * @param onMove    called with the new position
 * @param answerAt  where the real answer sits, 0 to 1, once revealed
 * @param tier      close | near | far once revealed, null before
 * @param zoneFrom  where a striped end zone starts, for a scale with one
 * @param ticks     marks under the rail: { at, label, zone }
 * @param value     the big readout, and sub the line under it
 * @param children  under the rail: the lock-in button, or the outcome
 */
export default function Dial({
  position, steps, onMove, answerAt, tier, locking, zoneFrom, ticks = [],
  value, sub, label, valueText, children,
}) {
  const revealed = tier != null
  return (
    <div
      className={`dial${revealed ? ` dial--revealed dial--${tier}` : ''}${locking ? ' dial--locking' : ''}`}
      style={{ '--guess': position, '--actual': answerAt ?? position, '--zone': zoneFrom ?? 1 }}
    >
      <div className="dial__readout" aria-live="polite">
        <span key={revealed ? 'answer' : 'guess'} className="dial__value">{value}</span>
        {sub && <span className="dial__sub">{sub}</span>}
      </div>

      <div className="dial__rail">
        <div className="dial__track" aria-hidden="true">
          {zoneFrom != null && <span className="dial__zone" />}
        </div>
        {revealed && <span className="dial__gap" aria-hidden="true" />}
        {revealed && <span className="dial__actual" aria-hidden="true" />}
        <input
          type="range"
          className="dial__input"
          min="0"
          max={steps}
          step="1"
          value={Math.round(position * steps)}
          onChange={(e) => onMove(Number(e.target.value) / steps)}
          disabled={revealed || locking}
          aria-label={label}
          aria-valuetext={valueText}
        />
      </div>

      {ticks.length > 0 && (
        <div className="dial__ticks" aria-hidden="true">
          {ticks.map(t => (
            <span key={t.label} className={t.zone ? 'dial__tick-zone' : undefined} style={{ '--at': t.at }}>{t.label}</span>
          ))}
        </div>
      )}

      {children}
    </div>
  )
}
