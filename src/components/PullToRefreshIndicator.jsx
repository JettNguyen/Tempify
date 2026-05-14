import './PullToRefreshIndicator.css'

const THRESHOLD = 72

export default function PullToRefreshIndicator({ pullDistance, isRefreshing }) {
  const visible = pullDistance > 4 || isRefreshing
  if (!visible) return null

  const progress = Math.min(pullDistance / THRESHOLD, 1)
  const pastThreshold = pullDistance >= THRESHOLD
  const opacity = isRefreshing ? 1 : Math.min(progress * 1.5, 1)
  const scale = isRefreshing ? 1 : (0.5 + progress * 0.5)

  return (
    <div
      className="ptr-indicator"
      style={{ opacity, transform: `translateX(-50%) scale(${scale})` }}
      aria-hidden="true"
    >
      {isRefreshing ? (
        <div className="ptr-spinner" />
      ) : (
        <svg
          className={`ptr-arrow${pastThreshold ? ' ptr-arrow--flip' : ''}`}
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
        >
          <path
            d="M9 2v10M4 8l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  )
}
