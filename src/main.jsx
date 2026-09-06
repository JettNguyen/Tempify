import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Self-hosted so a cold start never waits on the Google Fonts CDN, and the
// app renders in its real typeface offline.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import './styles/globals.css'

// Polyfill crypto.randomUUID for environments that lack it
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
