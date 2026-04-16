import { Check } from 'lucide-react'

export function StatCard({
  icon: Icon,
  iconClass,
  label,
  value,
  footer,
  footerClass,
  showCheck,
}) {
  return (
    <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b]">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <span className="pt-0.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      {footer && (
        <div
          className={`mt-2 flex items-center gap-1 text-xs font-medium ${footerClass || 'text-slate-500 dark:text-slate-400'}`}
        >
          {showCheck && (
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" strokeWidth={3} />
          )}
          {footer}
        </div>
      )}
    </div>
  )
}
