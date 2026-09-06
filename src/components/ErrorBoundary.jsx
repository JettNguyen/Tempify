import { Component } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import './ErrorBoundary.css'

class ErrorBoundaryInner extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('[Tempify] render error:', error, info?.componentStack)
  }

  componentDidUpdate(prevProps) {
    // Navigating away is the natural escape hatch, so clear the error then.
    if (this.state.failed && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false })
    }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div className="page-shell error-boundary">
        <Icon name="alert" size={30} className="error-boundary__icon" />
        <h1 className="error-boundary__title">Something went wrong</h1>
        <p className="error-boundary__body">
          That screen failed to load. Your progress for today is saved.
        </p>
        <div className="error-boundary__actions">
          <button
            type="button"
            className="error-boundary__btn btn-press btn-amber"
            onClick={() => this.props.onGoHome()}
          >
            Back to games
          </button>
          <button
            type="button"
            className="error-boundary__btn btn-press btn-hover"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}

export default function ErrorBoundary({ children }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <ErrorBoundaryInner resetKey={pathname} onGoHome={() => navigate('/', { replace: true })}>
      {children}
    </ErrorBoundaryInner>
  )
}
