import { useEffect, useState } from 'react'
import './DelayedSpinner.css'

export default function DelayedSpinner({
  active,
  delayMs = 2000,
  label = 'Loading...',
  inline = false,
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }

    const timer = window.setTimeout(() => setVisible(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [active, delayMs])

  if (!visible) return null

  return (
    <div className={`delayed-spinner${inline ? ' delayed-spinner--inline' : ''}`} role="status" aria-live="polite" aria-label={label}>
      <span className="delayed-spinner__ring" aria-hidden="true" />
      <p className="delayed-spinner__label">{label}</p>
    </div>
  )
}
