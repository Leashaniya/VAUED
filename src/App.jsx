import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { Dashboard } from './pages/Dashboard'
import { Analytics } from './pages/Analytics'
import { dashboardCanvasClass } from './constants/layout'

export default function App() {
  const [dark, setDark] = useState(false)
  const [page, setPage] = useState('dashboard')
  const [filter, setFilter] = useState('7d')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <Sidebar active={page} onNavigate={setPage} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-start overflow-hidden bg-[#f8fafc] dark:bg-[#111827]">
        <div className={dashboardCanvasClass}>
          <Header
            dark={dark}
            onToggleTheme={() => setDark((d) => !d)}
            notificationsOpen={notificationsOpen}
            setNotificationsOpen={setNotificationsOpen}
            profileOpen={profileOpen}
            setProfileOpen={setProfileOpen}
          />
          {page === 'dashboard' ? (
            <Dashboard dark={dark} />
          ) : (
            <Analytics dark={dark} filter={filter} setFilter={setFilter} />
          )}
        </div>
      </div>
    </div>
  )
}
