export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-500 dark:bg-red-500/10 dark:text-red-400">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Live
    </span>
  )
}

export function TodayPill() {
  return (
    <span className="rounded-full bg-cyan-100 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300">
      Today
    </span>
  )
}

export function SystemOnlineBadge() {
  return (
    <span className="ml-2 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400 sm:ml-3">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      System Online
    </span>
  )
}
