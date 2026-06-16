import { useState, useEffect } from 'react'
import AdminPage from './pages/AdminPage'
import DraftPage from './pages/DraftPage'
import LeaderboardPage from './pages/LeaderboardPage'

export default function App() {
  const [page, setPage] = useState(window.location.hash || '#leaderboard')

  useEffect(() => {
    const onHashChange = () => setPage(window.location.hash || '#leaderboard')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return (
    <div className="app">
      <header>
        <div className="header-inner">
          <div className="site-title">
            <span className="flag">⛳</span>
            <span>US Open Pool 2026</span>
          </div>
          <nav>
            <a href="#leaderboard" className={page === '#leaderboard' ? 'active' : ''}>
              Leaderboard
            </a>
            <a href="#draft" className={page === '#draft' ? 'active' : ''}>
              Draft Room
            </a>
            <a href="#admin" className={page === '#admin' ? 'active' : ''}>
              Admin
            </a>
          </nav>
        </div>
      </header>
      <main>
        {page === '#leaderboard' && <LeaderboardPage />}
        {page === '#draft' && <DraftPage />}
        {page === '#admin' && <AdminPage />}
      </main>
    </div>
  )
}
