import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Archive from './pages/Archive'
import ArchiveDay from './pages/ArchiveDay'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Subscribe from './pages/Subscribe'
import Success from './pages/Success'
import OneBar from './games/OneBar'
import DropOrFlop from './games/DropOrFlop'
import WhoSampledIt from './games/WhoSampledIt'
import Era from './games/Era'
import TheFlip from './games/TheFlip'

export default function App() {
  return (
    <BrowserRouter basename="/Tempify">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/one-bar" element={<OneBar />} />
        <Route path="/game/drop-or-flop" element={<DropOrFlop />} />
        <Route path="/game/who-sampled-it" element={<WhoSampledIt />} />
        <Route path="/game/era" element={<Era />} />
        <Route path="/game/the-flip" element={<TheFlip />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/archive/:date" element={<ArchiveDay />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/success" element={<Success />} />
      </Routes>
    </BrowserRouter>
  )
}
