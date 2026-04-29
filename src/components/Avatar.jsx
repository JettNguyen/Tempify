import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getIconByKey } from '../lib/avatar'
import './Avatar.css'

export default function Avatar({ iconKey, color, initial = '?', size = 32 }) {
  const icon = iconKey ? getIconByKey(iconKey) : null
  const fontSize = Math.round(size * 0.42)

  if (icon && color) {
    return (
      <div
        className="avatar"
        style={{ width: size, height: size, background: color }}
      >
        <FontAwesomeIcon icon={icon} style={{ color: '#fff', fontSize }} />
      </div>
    )
  }

  return (
    <div
      className="avatar avatar--default"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initial}
    </div>
  )
}
