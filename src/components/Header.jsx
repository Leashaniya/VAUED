import { useRef, useEffect } from 'react'
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

  return (
    <header
      className={`flex w-full shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 ${headerPaddingY} dark:border-slate-800`}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Nursery Overview:{' '}
          <span className="font-semibold text-cyan-500 dark:text-cyan-400">
            Baby Jamie
          </span>
        </h1>
        <SystemOnlineBadge />
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
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#1e293b]" />
          </button>
          <NotificationDropdown
            open={notificationsOpen}
            onMarkAllRead={() => setNotificationsOpen(false)}
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
                ? 'border-cyan-400 bg-cyan-50 text-cyan-600 dark:border-cyan-500 dark:bg-cyan-500/20 dark:text-cyan-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-[#1e293b] dark:text-slate-300 dark:hover:bg-slate-700/80'
            }`}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
          >
            <User className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <ProfileDropdown open={profileOpen} />
        </div>
      </div>
    </header>
  )
}
