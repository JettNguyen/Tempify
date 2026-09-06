import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import ErrorBoundary from './components/ErrorBoundary'
import DelayedSpinner from './components/DelayedSpinner'
import UsernameSetupModal from './components/UsernameSetupModal'
import Home from './pages/Home'
import ArchiveDay from './pages/ArchiveDay'
import Explore from './pages/Explore'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Profile from './pages/Profile'
import PublicProfile from './pages/PublicProfile'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Subscribe from './pages/Subscribe'
import Success from './pages/Success'
import OneBar from './games/OneBar'
import HitOrMiss from './games/HitOrMiss'
import Sampled from './games/Sampled'
import Era from './games/Era'
import CoverOrNot from './games/CoverOrNot'
import { useIOSIPadUI } from './hooks/useIOSIPadUI'
import { useScrolling } from './hooks/useScrolling'
import { useNativeSplash } from './hooks/useNativeSplash'
import { initKeyboard } from './lib/keyboard'
import { useKeyboardDismiss } from './hooks/useKeyboardDismiss'
import { useAuth } from './hooks/useAuth'

// Admin is a large, single-user screen — keep it out of everyone else's bundle.
const Admin = lazy(() => import('./pages/Admin'))

// Lives inside AuthProvider so it can wait for the session check to settle —
// otherwise the splash hands off to a signed-out navbar that then pops.
function SplashGate() {
  const { loading } = useAuth()
  useNativeSplash(!loading)
  return null
}

// Re-keying on pathname remounts the routed view, so the enter animation
// replays on every navigation. Query changes (?date=, ?view=) keep the same
// key on purpose — those are in-page state, not a new screen.
function PageTransition({ children }) {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    // Opening a new screen should start at the top. Going back shouldn't —
    // leave the browser's own restoration alone there.
    if (navigationType === 'POP') return
    document.querySelector('.app-scroll-container')?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [pathname, navigationType])

  return <div key={pathname} className="page-enter">{children}</div>
}

export default function App() {
  useIOSIPadUI()
  useScrolling()

  // Enables the keyboard's Done button; Capacitor hides it by default.
  useEffect(() => { initKeyboard() }, [])
  useKeyboardDismiss()

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <SplashGate />
        <Navbar />
        <UsernameSetupModal />
        <div className="app-scroll-container">
          <ErrorBoundary>
            <Suspense fallback={<div className="page-shell"><DelayedSpinner active label="Loading..." /></div>}>
              <PageTransition>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/game/one-bar" element={<OneBar />} />
                  <Route path="/game/hit-or-miss" element={<HitOrMiss />} />
                  <Route path="/game/sampled" element={<Sampled />} />
                  <Route path="/game/era" element={<Era />} />
                  <Route path="/game/cover-or-not" element={<CoverOrNot />} />
                  <Route path="/dashboard" element={<Navigate to="/profile" replace />} />
                  <Route path="/archive" element={<Navigate to="/explore" replace />} />
                  <Route path="/archive/:date" element={<ArchiveDay />} />
                  <Route path="/explore" element={<Explore />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/u/:username" element={<PublicProfile />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/subscribe" element={<Subscribe />} />
                  <Route path="/success" element={<Success />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </PageTransition>
            </Suspense>
          </ErrorBoundary>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
