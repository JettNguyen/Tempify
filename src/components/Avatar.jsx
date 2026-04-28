import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getIconByKey } from '../lib/avatar'

export default function Avatar({ iconKey, color, initial = '?', size = 32 }) {
  const icon = iconKey ? getIconByKey(iconKey) : null
  const fontSize = Math.round(size * 0.42)

  if (icon && color) {
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <FontAwesomeIcon icon={icon} style={{ color: '#fff', fontSize }} />
      </div>
    )
  }

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-primary)',
      fontSize: Math.round(size * 0.38),
      fontWeight: 500,
      flexShrink: 0,
    }}>
      {initial}
    </div>
  )
}
