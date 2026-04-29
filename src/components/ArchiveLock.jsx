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
      <p className="archive-lock__title">Upgrade to premium to unlock the archive</p>
      <p className="archive-lock__body">
        Browse every past puzzle, replay older days, and keep the full Tempify catalog open.
      </p>
      <Link to="/subscribe" className="archive-lock__cta btn-press">
        Upgrade
      </Link>
    </div>
  )
}
