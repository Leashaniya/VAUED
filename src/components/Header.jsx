import { useRef, useEffect, useMemo } from 'react'
import { Bell, Moon, Sun, User } from 'lucide-react'
import { SystemOnlineBadge } from './LiveBadge'
import { NotificationDropdown } from './NotificationDropdown'
import { ProfileDropdown } from './ProfileDropdown'
import { headerPaddingY } from '../constants/layout'

export function Header({
  dark,
  onToggleTheme,
  notificationsOpen,
  setNotificationsOpen,
  profileOpen,
  setProfileOpen,
  notifications = [],
  activeBabyName = 'Baby Jamie',
  activeBabyMeta = '',
  parentName = '',
  parentEmail = '',
  onAddBabyProfile,
  onSwitchBabyProfile,
  onLogout,
}) {
  const bellRef = useRef(null)
  const profileRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      const t = e.target
      if (bellRef.current && !bellRef.current.contains(t)) {
        setNotificationsOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(t)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [setNotificationsOpen, setProfileOpen])

  const hasActiveNotifications = notifications.length > 0

  const welcomeLine = useMemo(() => {
    if (!parentName?.trim() && !parentEmail) return null
    const first = parentName?.trim()?.split(/\s+/)[0]
    if (first) return `Welcome back, ${first}`
    const local = parentEmail?.split('@')[0]
    return local ? `Welcome back, ${local}` : null
  }, [parentName, parentEmail])

  return (
    <header
      className={`flex w-full shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 ${headerPaddingY} dark:border-slate-800`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Nursery Overview:{' '}
            <span className="font-semibold" style={{ color: 'var(--sbm-accent)' }}>
              {activeBabyName}
            </span>
          </h1>
          {activeBabyMeta && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: 'var(--sbm-accent-soft)', color: 'var(--sbm-accent-text)' }}
            >
              {activeBabyMeta}
            </span>
          )}
          <SystemOnlineBadge />
        </div>
        {welcomeLine && (
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{welcomeLine}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((v) => !v)
              setProfileOpen(false)
            }}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-[#1e293b] dark:text-slate-300 dark:hover:bg-slate-700/80"
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
            {hasActiveNotifications && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#1e293b]" />
            )}
          </button>
          <NotificationDropdown
            open={notificationsOpen}
            onMarkAllRead={() => setNotificationsOpen(false)}
            notifications={notifications}
          />
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-[#1e293b] dark:text-slate-300 dark:hover:bg-slate-700/80"
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? (
            <Sun className="h-[18px] w-[18px]" strokeWidth={2} />
          ) : (
            <Moon className="h-[18px] w-[18px]" strokeWidth={2} />
          )}
        </button>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => {
              setProfileOpen((v) => !v)
              setNotificationsOpen(false)
            }}
            className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition ${
              profileOpen
                ? 'bg-slate-50 dark:bg-slate-700/50'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-[#1e293b] dark:text-slate-300 dark:hover:bg-slate-700/80'
            }`}
            style={
              profileOpen
                ? {
                    borderColor: 'var(--sbm-accent)',
                    color: 'var(--sbm-accent)',
                  }
                : undefined
            }
            aria-expanded={profileOpen}
            aria-haspopup="menu"
          >
            <User className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <ProfileDropdown
            open={profileOpen}
            onAddBaby={onAddBabyProfile}
            onSwitchBaby={onSwitchBabyProfile}
            onLogout={onLogout}
            activeBabyName={activeBabyName}
            activeBabyMeta={activeBabyMeta}
            parentName={parentName}
            parentEmail={parentEmail}
          />
        </div>
      </div>
    </header>
  )
}
