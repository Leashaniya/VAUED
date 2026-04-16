import { Volume2, Droplets, AlertTriangle } from 'lucide-react'
import { notifications } from '../data/mockData'

const iconMap = {
  volume: Volume2,
  droplet: Droplets,
  alert: AlertTriangle,
}

const toneStyles = {
  red: 'bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-400',
  blue: 'bg-sky-50 text-sky-500 dark:bg-sky-500/15 dark:text-sky-400',
  orange: 'bg-amber-50 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400',
}

export function NotificationDropdown({ open, onMarkAllRead }) {
  if (!open) return null

  return (
    <div
      className="absolute right-0 top-[calc(100%+10px)] z-50 w-[340px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl dark:border-slate-700 dark:bg-[#1e293b]"
      role="dialog"
      aria-label="Notifications"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          Real-time Alerts
        </span>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="text-[11px] font-semibold uppercase tracking-wide text-cyan-500 hover:text-cyan-600 dark:text-cyan-400"
        >
          Mark all as read
        </button>
      </div>
      <ul className="max-h-[320px] divide-y divide-slate-100 dark:divide-slate-700">
        {notifications.map((n) => {
          const Icon = iconMap[n.icon] || AlertTriangle
          return (
            <li key={n.id} className="flex gap-3 px-5 py-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneStyles[n.tone]}`}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {n.title}
                  </p>
                  <span className="shrink-0 text-xs text-slate-400">{n.time}</span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {n.detail}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
