import { formatBabyAgeShort, babyInitials } from '../utils/babyAge'

function formatDobDisplay(dob) {
  if (!dob) return '—'
  const d = String(dob).slice(0, 10)
  return d || '—'
}

export function SwitchBabyModal({ open, onClose, babies, activeBabyId, onSwitch }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-[#1e293b]">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Switch Baby Profile</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Choose which profile drives the dashboard, alerts, and accent theme.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2.5">
          {babies.length === 0 && (
            <p className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
              No baby profiles yet. Add a profile first.
            </p>
          )}
          {babies.map((baby) => {
            const active = activeBabyId === baby.id
            const age = formatBabyAgeShort(baby.dob)
            const initials = babyInitials(baby.name)
            return (
              <button
                key={baby.id}
                type="button"
                onClick={() => onSwitch?.(baby.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition ${
                  active
                    ? 'border bg-cyan-50/80 dark:bg-cyan-500/15'
                    : 'border border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800/40'
                }`}
                style={active ? { borderColor: 'var(--sbm-accent)' } : undefined}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                    style={{ backgroundColor: 'var(--sbm-accent)' }}
                  >
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-white">{baby.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          baby.gender === 'girl'
                            ? 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300'
                            : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300'
                        }`}
                      >
                        {baby.gender === 'girl' ? 'Girl' : 'Boy'}
                      </span>
                      {baby.twinLabel && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {baby.twinLabel}
                        </span>
                      )}
                      {active && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Born {formatDobDisplay(baby.dob)}
                      {age ? ` · ${age}` : ''}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
