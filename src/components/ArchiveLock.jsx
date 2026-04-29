import { Link } from 'react-router-dom'
import './ArchiveLock.css'

export default function ArchiveLock() {
  return (
    <div className="archive-lock slide-up">
      <div className="archive-lock__icon">
        <svg width="16" height="18" viewBox="0 0 16 18" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round">
          <rect x="2" y="8" width="12" height="10" rx="2"/>
          <path d="M5 8V5a3 3 0 0 1 6 0v3"/>
        </svg>
      </div>
      <p className="archive-lock__title">Archive is for subscribers</p>
      <p className="archive-lock__body">
        Play back any day with a Tempify subscription.
      </p>
      <Link to="/subscribe" className="archive-lock__cta btn-press">
        See plans
      </Link>
    </div>
  )
}
