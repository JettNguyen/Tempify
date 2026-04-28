import { Link } from 'react-router-dom'

export default function GameTile({ name, description, path, complete, featured }) {
  return (
    <Link
      to={path}
      style={{
        display: 'block',
        position: 'relative',
        padding: featured ? '2rem 1.75rem' : '1.5rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        overflow: 'hidden',
        textDecoration: 'none',
        transition: 'background 80ms ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#1e1e1e'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}
    >
      {/* Waveform decoration for the featured tile */}
      {featured && (
        <svg
          aria-hidden="true"
          viewBox="0 0 320 60"
          style={{
            position: 'absolute',
            right: '-10px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '180px',
            opacity: 0.06,
            pointerEvents: 'none',
          }}
        >
          {[4,10,18,28,14,22,36,16,30,8,20,32,12,24,40,16,28,8,18,10,6,14,20,12,16,8,4,10,16,6].map((h, i) => (
            <rect
              key={i}
              x={i * 11}
              y={(60 - h) / 2}
              width="7"
              height={h}
              rx="3"
              fill="var(--text-primary)"
            />
          ))}
        </svg>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, paddingRight: featured ? '120px' : 0 }}>
          <div style={{
            fontSize: '15px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            marginBottom: '0.35rem',
          }}>
            {name}
          </div>
          <div style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}>
            {description}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {/* Completion indicator */}
          {complete ? (
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--green)',
              display: 'inline-block',
            }} title="Completed today" />
          ) : (
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--amber)',
              display: 'inline-block',
            }} title="Not played yet" />
          )}
        </div>
      </div>

      {/* Play button */}
      <div style={{ marginTop: '1.25rem' }}>
        <span
          className="btn-press"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--amber)',
            padding: '6px 14px',
            border: '1px solid var(--amber)',
            borderRadius: '999px',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="var(--amber)">
            <path d="M1 1L9 5L1 9V1Z"/>
          </svg>
          Play
        </span>
      </div>
    </Link>
  )
}
