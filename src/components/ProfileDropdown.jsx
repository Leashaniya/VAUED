import { Baby, Settings, Trash2 } from 'lucide-react'

export function ProfileDropdown({ open }) {
  if (!open) return null

  return (
    <div
      className="absolute right-0 top-[calc(100%+10px)] z-50 w-[260px] overflow-hidden rounded-2xl border border-slate-100 bg-white py-2 shadow-xl dark:border-slate-700 dark:bg-[#1e293b]"
      role="menu"
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
      >
        <Baby className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        Edit Baby Profile
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
      >
        <Settings className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        Account Preferences
      </button>
      <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
      >
        <Trash2 className="h-4 w-4" />
        Delete Account
      </button>
    </div>
  )
}
