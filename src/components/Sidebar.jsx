import { LayoutDashboard, BarChart3, Baby } from 'lucide-react'

export function Sidebar({ active, onNavigate }) {
  const link =
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors'
  const inactive =
    'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5'
  const activeCls = 'bg-slate-100 dark:bg-slate-700/40'

  return (
    <aside className="flex h-full min-h-0 w-[240px] shrink-0 flex-col overflow-y-auto bg-white px-4 py-6 dark:bg-[#0f172a]">
      <div className="mb-8 flex shrink-0 items-center gap-2.5 px-0.5">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ backgroundColor: 'var(--sbm-accent)' }}
        >
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
          style={active === 'dashboard' ? { color: 'var(--sbm-accent)' } : undefined}
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" strokeWidth={2} />
          Dashboard Overview
        </button>
        <button
          type="button"
          onClick={() => onNavigate('analytics')}
          className={`${link} ${active === 'analytics' ? activeCls : inactive}`}
          style={active === 'analytics' ? { color: 'var(--sbm-accent)' } : undefined}
        >
          <BarChart3 className="h-5 w-5 shrink-0" strokeWidth={2} />
          Analytics
        </button>
      </nav>
    </aside>
  )
}
