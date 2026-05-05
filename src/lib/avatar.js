import {
  faMusic,
  faHeadphones,
  faMicrophone,
  faGuitar,
  faDrum,
  faCompactDisc,
  faRecordVinyl,
  faVolumeHigh,
  faRadio,
  faBolt,
} from '@fortawesome/free-solid-svg-icons'
import { supabase } from './supabase'

export const AVATAR_ICONS = [
  { key: 'music',        icon: faMusic,        label: 'Note' },
  { key: 'headphones',   icon: faHeadphones,   label: 'Headphones' },
  { key: 'microphone',   icon: faMicrophone,   label: 'Mic' },
  { key: 'guitar',       icon: faGuitar,       label: 'Guitar' },
  { key: 'drum',         icon: faDrum,         label: 'Drum' },
  { key: 'compact-disc', icon: faCompactDisc,  label: 'Disc' },
  { key: 'record-vinyl', icon: faRecordVinyl,  label: 'Vinyl' },
  { key: 'volume-high',  icon: faVolumeHigh,   label: 'Speaker' },
  { key: 'radio',        icon: faRadio,        label: 'Radio' },
  { key: 'bolt',         icon: faBolt,         label: 'Bolt' },
]

export const AVATAR_COLORS = [
  { hex: '#f59e0b', label: 'Amber' },
  { hex: '#3b82f6', label: 'Blue' },
  { hex: '#8b5cf6', label: 'Purple' },
  { hex: '#ec4899', label: 'Pink' },
  { hex: '#22c55e', label: 'Green' },
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#f97316', label: 'Orange' },
  { hex: '#ef4444', label: 'Red' },
  { hex: '#64748b', label: 'Slate' },
]

export function getIconByKey(key) {
  return AVATAR_ICONS.find((i) => i.key === key)?.icon ?? null
}

export async function saveAvatar(userId, { icon, color }) {
  const { error } = await supabase
    .from('users')
    .update({ avatar_icon: icon, avatar_color: color })
    .eq('id', userId)
  if (error) throw error
}

export async function saveProfileSettings(userId, updates) {
  const patch = {}
  if ('username' in updates) patch.username = updates.username || null
  if ('leaderboardVisibility' in updates) patch.leaderboard_visibility = updates.leaderboardVisibility
  if ('autoplayAudio' in updates) patch.autoplay_audio = updates.autoplayAudio
  if ('competitiveMode' in updates) patch.competitive_mode = updates.competitiveMode
  const { error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', userId)
  if (error) throw error
}

export async function checkUsernameAvailable(username, currentUserId) {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('username', username.toLowerCase().trim())
    .neq('id', currentUserId)
    .single()
  return !data
}

// Returns the email for a given username, or null if not found
export async function getEmailByUsername(username) {
  const { data } = await supabase
    .from('users')
    .select('email')
    .eq('username', username.toLowerCase().trim())
    .single()
  return data?.email ?? null
}
