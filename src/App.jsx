import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import UsernameSetupModal from './components/UsernameSetupModal'
import Home from './pages/Home'
import Archive from './pages/Archive'
import ArchiveDay from './pages/ArchiveDay'
import Explore from './pages/Explore'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Profile from './pages/Profile'
import PublicProfile from './pages/PublicProfile'
import Subscribe from './pages/Subscribe'
import Success from './pages/Success'
import Admin from './pages/Admin'
import OneBar from './games/OneBar'
import HitOrMiss from './games/HitOrMiss'
import Sampled from './games/Sampled'
import Era from './games/Era'
import CoverOrNot from './games/CoverOrNot'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Navbar />
        <UsernameSetupModal />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game/one-bar" element={<OneBar />} />
          <Route path="/game/hit-or-miss" element={<HitOrMiss />} />
          <Route path="/game/sampled" element={<Sampled />} />
          <Route path="/game/era" element={<Era />} />
          <Route path="/game/cover-or-not" element={<CoverOrNot />} />
          <Route path="/dashboard" element={<Navigate to="/profile" replace />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/archive/:date" element={<ArchiveDay />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/success" element={<Success />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
