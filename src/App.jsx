import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Archive from './pages/Archive'
import ArchiveDay from './pages/ArchiveDay'
import Explore from './pages/Explore'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Profile from './pages/Profile'
import Subscribe from './pages/Subscribe'
import Success from './pages/Success'
import Admin from './pages/Admin'
import OneBar from './games/OneBar'
import DropOrFlop from './games/DropOrFlop'
import WhoSampledIt from './games/WhoSampledIt'
import Era from './games/Era'
import CoverOrNot from './games/TheFlip'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game/one-bar" element={<OneBar />} />
          <Route path="/game/drop-or-flop" element={<DropOrFlop />} />
          <Route path="/game/who-sampled-it" element={<WhoSampledIt />} />
          <Route path="/game/era" element={<Era />} />
          <Route path="/game/cover-or-not" element={<CoverOrNot />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/archive/:date" element={<ArchiveDay />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/success" element={<Success />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
