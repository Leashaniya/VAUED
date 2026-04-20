import { Baby, Repeat, LogOut } from 'lucide-react'

export function ProfileDropdown({
  open,
  onAddBaby,
  onSwitchBaby,
  onLogout,
  activeBabyName = '',
  activeBabyMeta = '',
  parentName = '',
  parentEmail = '',
}) {
  if (!open) return null

  return (
    <div
      className="absolute right-0 top-[calc(100%+10px)] z-50 w-[280px] overflow-hidden rounded-2xl border border-slate-100 bg-white py-2 shadow-xl dark:border-slate-700 dark:bg-[#1e293b]"
      role="menu"
    >
      {(parentName || parentEmail) && (
        <div className="border-b border-slate-100 px-4 pb-3 pt-2 dark:border-slate-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Your account
          </p>
          {parentName && (
            <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{parentName}</p>
          )}
          {parentEmail && (
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{parentEmail}</p>
          )}
        </div>
      )}
      <div className="border-b border-slate-100 px-4 pb-3 pt-3 dark:border-slate-700">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Active baby
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
          {activeBabyName || 'No baby profile'}
        </p>
        {activeBabyMeta && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{activeBabyMeta}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onAddBaby}
        className="mt-1 flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
      >
        <Baby className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        Add Baby Profile
      </button>
      <button
        type="button"
        onClick={onSwitchBaby}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
      >
        <Repeat className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        Switch Baby Profile
      </button>
      <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
      <button
        type="button"
        onClick={onLogout}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
      >
        <LogOut className="h-4 w-4" />
        Log Out
      </button>
    </div>
  )
}
