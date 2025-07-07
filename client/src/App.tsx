import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import DraftRoom from './pages/DraftRoom'
import PlayersPage from './pages/PlayersPage'
import ShortlistPage from './pages/ShortlistPage'
import PlayerComparisonPage from './pages/PlayerComparisonPage'
import { DraftProvider } from './context/DraftContext'
import { Toaster } from 'sonner'

function App() {
  return (
    <DraftProvider>
      <Router>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/shortlist" element={<ShortlistPage />} />
            <Route path="/compare-players" element={<PlayerComparisonPage />} />
            <Route path="/draft/:code" element={<DraftRoom />} />
          </Routes>
        </div>
        <Toaster />
      </Router>
    </DraftProvider>
  )
}

export default App