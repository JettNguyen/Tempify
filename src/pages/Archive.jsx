import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ArchiveLock from '../components/ArchiveLock'

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
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>archive</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {monthName}
          </h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <NavButton onClick={prevMonth} label="←" />
            <NavButton onClick={nextMonth} label="→" disabled={isCurrentMonth} />
          </div>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '4px',
        marginBottom: '4px',
      }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} style={{
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--text-dim)',
            padding: '4px 0',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '4px',
      }}>
        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1
          const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
          const isToday = dateStr === todayStr
          const isFuture = dateStr > todayStr
          const isPast = dateStr < todayStr

          if (isFuture) {
            return (
              <div key={day} style={dayStyle(false, false)}>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{day}</span>
              </div>
            )
          }

          if (isToday) {
            return (
              <Link key={day} to={`/archive/${dateStr}`} className="day-hover btn-press" style={dayLinkStyle(true)}>
                <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{day}</span>
              </Link>
            )
          }

          // Past date
          if (!isSubscribed) {
            return (
              <Link key={day} to={`/archive/${dateStr}`} className="day-hover btn-press" style={{ ...dayLinkStyle(false), opacity: 0.4 }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{day}</span>
              </Link>
            )
          }

          return (
            <Link key={day} to={`/archive/${dateStr}`} className="day-hover btn-press" style={dayLinkStyle(false)}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{day}</span>
              <span style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: 'var(--amber)',
                display: 'block',
                margin: '2px auto 0',
              }} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function dayStyle(isToday, clickable) {
  return {
    aspectRatio: '1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    border: isToday ? '1px solid var(--amber)' : '1px solid transparent',
    background: 'transparent',
  }
}

function dayLinkStyle(isToday) {
  return {
    ...dayStyle(isToday, true),
    textDecoration: 'none',
    cursor: 'pointer',
  }
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
