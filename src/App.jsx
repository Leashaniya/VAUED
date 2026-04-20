import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { Dashboard } from './pages/Dashboard'
import { Analytics } from './pages/Analytics'
import { Login } from './pages/Login'
import { BabyProfileModal } from './components/BabyProfileModal'
import { SwitchBabyModal } from './components/SwitchBabyModal'
import { dashboardCanvasClass } from './constants/layout'
import { getCurrentUser, getSessionUser, isAuthenticated, logoutSession } from './services/authService'
import {
  ACCENT_BY_GENDER,
  addBaby,
  getBabies,
  loadActiveBabyId,
  loadBabyProfiles,
  pickActiveBaby,
  saveActiveBabyId,
  switchBaby,
} from './services/babyProfileService'
import { formatBabyAgeShort } from './utils/babyAge'

const BANNER_MS = 4500

export default function App() {
  // Auth guard: JWT in localStorage; bootstrap validates with GET /api/auth/me.
  const [user, setUser] = useState(() => getSessionUser())
  const [authChecked, setAuthChecked] = useState(false)
  const [dark, setDark] = useState(false)
  const [page, setPage] = useState('dashboard')
  const [filter, setFilter] = useState('7d')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [dashboardNotifications, setDashboardNotifications] = useState([])
  const [babyProfiles, setBabyProfiles] = useState(() => loadBabyProfiles())
  const [activeBabyId, setActiveBabyId] = useState(() => loadActiveBabyId() || '')
  const [showAddBaby, setShowAddBaby] = useState(false)
  const [showSwitchBaby, setShowSwitchBaby] = useState(false)
  /** Subtle confirmation after add/switch baby (non-toast, auto-dismiss). */
  const [bannerMessage, setBannerMessage] = useState('')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const activeBaby = pickActiveBaby(babyProfiles, activeBabyId)
  const accentTheme = ACCENT_BY_GENDER[activeBaby?.gender] || ACCENT_BY_GENDER.boy
  // Header meta: gender, optional twin label, age from DOB (see utils/babyAge.js).
  const activeBabyMeta = activeBaby
    ? [activeBaby.gender === 'girl' ? 'Girl' : 'Boy', activeBaby.twinLabel || '', formatBabyAgeShort(activeBaby.dob)]
        .filter(Boolean)
        .join(' • ')
    : ''

  const appAccentVars = {
    '--sbm-accent': accentTheme.accent,
    '--sbm-accent-soft': accentTheme.accentSoft,
    '--sbm-accent-text': accentTheme.accentText,
  }

  useEffect(() => {
    if (!bannerMessage) return undefined
    const t = setTimeout(() => setBannerMessage(''), BANNER_MS)
    return () => clearTimeout(t)
  }, [bannerMessage])

  useEffect(() => {
    async function bootstrap() {
      if (!isAuthenticated()) {
        setAuthChecked(true)
        return
      }
      try {
        const me = await getCurrentUser()
        setUser(me)
        const babies = await getBabies()
        setBabyProfiles(babies)
        const saved = loadActiveBabyId()
        const activeFromServer = babies.find((b) => b.isActive)?.id
        const selected = saved || activeFromServer || babies[0]?.id || ''
        setActiveBabyId(selected)
        if (selected) saveActiveBabyId(selected)
      } catch {
        logoutSession()
        setUser(null)
      } finally {
        setAuthChecked(true)
      }
    }
    bootstrap()
  }, [])

  async function handleSaveBabyProfile(payload) {
    try {
      const created = await addBaby(payload)
      const babies = await getBabies()
      setBabyProfiles(babies)
      const newId = created.id
      if (newId) {
        setActiveBabyId(newId)
        saveActiveBabyId(newId)
        await switchBaby(newId)
      }
      setShowAddBaby(false)
      setProfileOpen(false)
      setBannerMessage(`Profile saved for ${payload.name.trim()}. You can switch babies anytime from the menu.`)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to save baby profile', err)
    }
  }

  async function handleSwitchBaby(id) {
    const baby = babyProfiles.find((b) => b.id === id)
    try {
      await switchBaby(id)
      const babies = await getBabies()
      setBabyProfiles(babies)
      setActiveBabyId(id)
      saveActiveBabyId(id)
      setShowSwitchBaby(false)
      setProfileOpen(false)
      if (baby?.name) {
        setBannerMessage(`Now monitoring ${baby.name}. Dashboard and alerts use this profile.`)
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to switch baby profile', err)
    }
  }

  function handleLogout() {
    logoutSession()
    setUser(null)
    setBabyProfiles([])
    setActiveBabyId('')
    setProfileOpen(false)
    setNotificationsOpen(false)
    setBannerMessage('')
  }

  async function handleLoginSuccess(nextUser) {
    setUser(nextUser)
    try {
      const babies = await getBabies()
      setBabyProfiles(babies)
      const activeFromServer = babies.find((b) => b.isActive)?.id
      const selected = activeFromServer || babies[0]?.id || ''
      setActiveBabyId(selected)
      if (selected) saveActiveBabyId(selected)
    } catch {
      setBabyProfiles([])
      setActiveBabyId('')
    }
  }

  // First-run onboarding: no baby profiles → open add modal (existing) + optional strip under header.
  useEffect(() => {
    if (user && babyProfiles.length === 0) {
      setShowAddBaby(true)
    }
  }, [user, babyProfiles.length])

  if (!user) {
    if (!authChecked) return null
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden bg-[#f8fafc] sm:gap-4 lg:gap-5 dark:bg-[#111827]"
      style={appAccentVars}
    >
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
            notifications={dashboardNotifications}
            activeBabyName={activeBaby?.name || 'Add Baby Profile'}
            activeBabyMeta={activeBabyMeta}
            parentName={user?.name || ''}
            parentEmail={user?.email || ''}
            onAddBabyProfile={() => {
              setProfileOpen(false)
              setShowAddBaby(true)
            }}
            onSwitchBabyProfile={() => {
              setProfileOpen(false)
              setShowSwitchBaby(true)
            }}
            onLogout={handleLogout}
          />
          {user && babyProfiles.length === 0 && showAddBaby && (
            <div className="mb-3 rounded-xl border border-cyan-200/50 bg-cyan-50/90 px-3 py-2.5 text-xs text-cyan-900 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-100">
              Let&apos;s set up your first baby profile to start monitoring. Use the form below — you can add more
              children (including twins) later from the profile menu.
            </div>
          )}
          {bannerMessage && (
            <div
              className="mb-3 rounded-xl border px-3 py-2 text-xs font-medium shadow-sm"
              style={{
                borderColor: 'var(--sbm-accent)',
                backgroundColor: 'var(--sbm-accent-soft)',
                color: 'var(--sbm-accent-text)',
              }}
              role="status"
            >
              {bannerMessage}
            </div>
          )}
          {page === 'dashboard' ? (
            <Dashboard
              dark={dark}
              onNotificationsChange={setDashboardNotifications}
              activeBaby={activeBaby}
            />
          ) : (
            <Analytics dark={dark} filter={filter} setFilter={setFilter} activeBaby={activeBaby} />
          )}
        </div>
      </div>
      <BabyProfileModal
        open={showAddBaby}
        onClose={() => setShowAddBaby(false)}
        onSave={handleSaveBabyProfile}
        isFirstSetup={babyProfiles.length === 0}
      />
      <SwitchBabyModal
        open={showSwitchBaby}
        onClose={() => setShowSwitchBaby(false)}
        babies={babyProfiles}
        activeBabyId={activeBabyId}
        onSwitch={handleSwitchBaby}
      />
    </div>
  )
}
