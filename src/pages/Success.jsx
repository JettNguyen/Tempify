import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Success.css'

export default function Success() {
  const { markSubscribed } = useAuth()

  useEffect(() => {
    markSubscribed()
  }, [])

  return (
    <div className="success-page">
      <div className="success-card">
        <div className="success-icon">
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <path d="M1 7L6.5 12.5L17 1" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="success-title">You're in.</h1>
        <p className="success-body">
          The full archive is now unlocked. Go back and play anything you've missed.
        </p>
        <div className="success-actions">
          <Link to="/archive" className="success-btn-primary btn-press">
            Open archive
          </Link>
          <Link to="/" className="success-btn-secondary btn-press btn-hover">
            Today's games
          </Link>
        </div>
      </div>
    </div>
  )
}
