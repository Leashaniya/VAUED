import { LayoutDashboard, BarChart3, Baby } from 'lucide-react'

export function Sidebar({ active, onNavigate }) {
  const link =
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors'
  const inactive =
    'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5'
  const activeCls =
    'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400'

  return (
    <aside className="flex h-full min-h-0 w-[240px] shrink-0 flex-col overflow-y-auto border-r border-slate-100/70 bg-white px-4 py-6 shadow-[1px_0_0_0_rgba(148,163,184,0.12)] dark:border-slate-800/60 dark:bg-[#0f172a] dark:shadow-[1px_0_0_0_rgba(51,65,85,0.35)]">
      <div className="mb-8 flex shrink-0 items-center gap-2.5 px-0.5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400 text-white shadow-sm dark:bg-cyan-500">
          <Baby className="h-6 w-6" strokeWidth={2} />
        </div>
        <span className="text-[15px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
          Smart Baby Monitor
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className={`${link} ${active === 'dashboard' ? activeCls : inactive}`}
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" strokeWidth={2} />
          Dashboard Overview
        </button>
        <button
          type="button"
          onClick={() => onNavigate('analytics')}
          className={`${link} ${active === 'analytics' ? activeCls : inactive}`}
        >
          <BarChart3 className="h-5 w-5 shrink-0" strokeWidth={2} />
          Analytics
        </button>
      </nav>
    </aside>
  )
}
