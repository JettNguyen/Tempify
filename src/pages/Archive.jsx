import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ArchiveLock from '../components/ArchiveLock'
import './Archive.css'

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

function pad(n) {
  return String(n).padStart(2, '0')
}

export default function Archive() {
  const { user, profile, loading } = useAuth()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: '/archive' }} replace />

  const isSubscribed = profile?.is_subscribed
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  const days = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(y => y - 1)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  function nextMonth() {
    const now = new Date()
    if (viewYear === now.getFullYear() && viewMonth === now.getMonth()) return
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(y => y + 1)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()

  return (
    <div className="page-shell-wide">
      <div className="archive-header">
        <p className="archive-eyebrow">archive</p>
        <div className="archive-month-row">
          <h1 className="archive-month-title">{monthName}</h1>
          <div className="archive-month-nav">
            <NavButton onClick={prevMonth} label="←" />
            <NavButton onClick={nextMonth} label="→" disabled={isCurrentMonth} />
          </div>
        </div>
      </div>

      <div className="archive-weekdays">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="archive-weekday">{d}</div>
        ))}
      </div>

      <div className="archive-grid">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1
          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
          const isToday = dateStr === todayStr
          const isFuture = dateStr > todayStr

          if (isFuture) {
            return (
              <div key={day} className="archive-day archive-day--future">
                <span className="archive-day__num archive-day__num--future">{day}</span>
              </div>
            )
          }

          if (isToday) {
            return (
              <Link key={day} to={`/archive/${dateStr}`} className="archive-day archive-day--today day-hover btn-press">
                <span className="archive-day__num archive-day__num--today">{day}</span>
              </Link>
            )
          }

          if (!isSubscribed) {
            return (
              <Link key={day} to={`/archive/${dateStr}`} className="archive-day day-hover btn-press" style={{ opacity: 0.4 }}>
                <span className="archive-day__num archive-day__num--past">{day}</span>
              </Link>
            )
          }

          return (
            <Link key={day} to={`/archive/${dateStr}`} className="archive-day day-hover btn-press">
              <span className="archive-day__num archive-day__num--past">{day}</span>
              <span className="archive-day__dot" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function NavButton({ onClick, label, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-press nav-btn"
      style={{
        width: '32px',
        height: '32px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        color: disabled ? 'var(--text-dim)' : 'var(--text-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      {label}
    </button>
  )
}
