import { useEffect, useMemo, useState } from 'react'
import { Calendar, Lightbulb, Sparkles, ArrowRight } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Pie,
  PieChart,
  Scatter,
  ComposedChart,
} from 'recharts'
import { pagePaddingBottom, pagePaddingTop } from '../constants/layout'
import { buildAnalyticsFromRows, loadHistoricalCsv } from '../utils/processAnalyticsData'
import { buildAnalyticsChatbotContext } from '../utils/buildChatbotContext'
import { AnalyticsChatbot } from '../components/AnalyticsChatbot'

function CryIncidentMarker(props) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  return <ellipse cx={cx} cy={cy} rx={4} ry={11} fill="#ef4444" />
}

const tabs = [
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'custom', label: 'Custom', icon: Calendar },
]

const dayOfWeekOptions = ['all', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const timeOfDayOptions = ['all', 'Night', 'Morning', 'Afternoon', 'Evening']
const crySeverityOptions = ['all', 'None', 'Mild', 'Moderate', 'Severe']
const tempCategoryOptions = ['all', 'Low', 'Normal', 'High']

/**
 * Developer-only: set to `true` to show the CSV validation strip + tables and log
 * `analytics.validation` to the console. Default off; CSV processing is unchanged.
 */
const ANALYTICS_VALIDATION_DEBUG = false

function filterModeLabel(id) {
  if (id === '7d') return '7d — last 7 days before latest CSV timestamp'
  if (id === '30d') return '30d — last 30 days before latest CSV timestamp'
  return 'custom — full normalized CSV range'
}

function formatCryWeekBadge(pct, filter) {
  if (pct === null || pct === undefined) return '—'
  const sign = pct > 0 ? '+' : ''
  const label =
    filter === '7d' ? 'vs prior week' : filter === '30d' ? 'vs prior 30 days' : 'vs prior window'
  return `${sign}${pct}% ${label}`
}

function formatStabilityBadge(pct) {
  if (pct === null || pct === undefined) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}% Stability`
}

function trendPillLabel(trend) {
  if (trend === 'improving') return 'Improving Trend'
  if (trend === 'worse') return 'Longer cries vs prior'
  if (trend === 'watch') return 'New activity'
  return 'Stable'
}

function trendPillClass(trend) {
  if (trend === 'improving')
    return 'shrink-0 rounded-full bg-cyan-50 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400'
  if (trend === 'worse')
    return 'shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
  return 'shrink-0 rounded-full bg-cyan-50 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400'
}

export function Analytics({ dark, filter, setFilter }) {
  const [allRows, setAllRows] = useState([])
  const [loadState, setLoadState] = useState('loading')
  const [loadError, setLoadError] = useState(null)
  const [advancedFilters, setAdvancedFilters] = useState({
    dayOfWeek: 'all',
    timeOfDay: 'all',
    crySeverity: 'all',
    tempCategory: 'all',
  })
  const [selectedWeekday, setSelectedWeekday] = useState(null)
  const [selectedDonutSegment, setSelectedDonutSegment] = useState(null)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoadState('loading')
    setLoadError(null)
    loadHistoricalCsv()
      .then((rows) => {
        if (!cancelled) {
          setAllRows(rows)
          setLoadState('ready')
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.log('[Analytics DEBUG] load complete, rows in state', rows.length)
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e?.message || 'Failed to load data')
          setLoadState('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const analytics = useMemo(
    () =>
      buildAnalyticsFromRows(allRows, filter, advancedFilters, {
        selectedWeekday,
        selectedDonutSegment,
      }, {
        customStartDate,
        customEndDate,
      }),
    [allRows, filter, advancedFilters, selectedWeekday, selectedDonutSegment, customStartDate, customEndDate],
  )

  function handleAdvancedFilterChange(key, value) {
    // Each select updates one dimension; all dimensions combine with AND logic in the utility.
    setAdvancedFilters((prev) => ({ ...prev, [key]: value }))
  }

  function handleWeekdayBarClick(day) {
    // Toggle weekday selection from chart interaction.
    setSelectedWeekday((prev) => (prev === day ? null : day))
  }

  function donutSegmentKey(name) {
    if (name === 'Wet & Crying') return 'wetCrying'
    if (name === 'Other Crying') return 'otherCrying'
    return null
  }

  function handleDonutClick(name) {
    const key = donutSegmentKey(name)
    if (!key) return
    // Toggle donut segment selection from chart interaction.
    setSelectedDonutSegment((prev) => (prev === key ? null : key))
  }

  useEffect(() => {
    if (!ANALYTICS_VALIDATION_DEBUG) return
    const v = analytics.validation
    if (!v) return
    // eslint-disable-next-line no-console
    console.log('[Analytics VALIDATION]', v)
  }, [analytics])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    // Concise Assignment 02 trace: selected extra filters + resulting row count.
    // eslint-disable-next-line no-console
    console.log('[Analytics FILTERS]', {
      rangeMode: filter,
      ...advancedFilters,
      selectedWeekday,
      selectedDonutSegment,
      customStartDate,
      customEndDate,
      filteredRows: analytics.meta.rowCount,
    })
  }, [
    filter,
    advancedFilters,
    selectedWeekday,
    selectedDonutSegment,
    customStartDate,
    customEndDate,
    analytics.meta.rowCount,
  ])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    // Generated summary lines for quick verification in development.
    // eslint-disable-next-line no-console
    console.log('[Analytics KEY INSIGHTS]', analytics?.insights?.lines ?? [])
  }, [analytics])

  const {
    cryByDay,
    analyticsTempSeries,
    cryIncidents,
    dailyAvgCryMin,
    cryingWetDonut,
    correlationPct,
    legendWetCry,
    legendOtherCry,
    totalEpisodes,
    avgTempCelsius,
    avgMinPerDaySummary,
    yMaxDuration,
    tempYDomain,
    badges,
    insights,
    validation,
  } = analytics

  const cryBadgeText = formatCryWeekBadge(badges.weekCryPct, filter)
  const stabilityBadgeText = formatStabilityBadge(badges.stabilityPct)
  const trendLabel = trendPillLabel(badges.trend)
  const trendClass = trendPillClass(badges.trend)

  const durationTicks = useMemo(() => {
    const step = yMaxDuration <= 20 ? 5 : 10
    const out = []
    for (let t = 0; t <= yMaxDuration; t += step) out.push(t)
    if (out[out.length - 1] < yMaxDuration) out.push(Math.ceil(yMaxDuration / step) * step)
    return [...new Set(out)].sort((a, b) => a - b)
  }, [yMaxDuration])

  const tempBadge =
    avgTempCelsius === null || !Number.isFinite(avgTempCelsius)
      ? '—'
      : `${avgTempCelsius}°C`

  const correlationDisplay = Number.isFinite(correlationPct)
    ? Math.round(correlationPct)
    : 0
  const avgMinDisplay = Number.isFinite(avgMinPerDaySummary)
    ? avgMinPerDaySummary
    : 0

  // Build chatbot input from already-processed dashboard state (not raw CSV parsing).
  const chatbotContext = useMemo(
    () =>
      buildAnalyticsChatbotContext({
        rangeMode: filter,
        advancedFilters,
        selections: { selectedWeekday, selectedDonutSegment },
        analytics,
        customRange: { customStartDate, customEndDate },
      }),
    [filter, advancedFilters, selectedWeekday, selectedDonutSegment, analytics, customStartDate, customEndDate],
  )

  const needsCustomDateSelection = filter === 'custom' && (!customStartDate || !customEndDate)
  const hasInvalidCustomRange =
    filter === 'custom' &&
    customStartDate &&
    customEndDate &&
    new Date(`${customStartDate}T00:00:00`).getTime() >
      new Date(`${customEndDate}T23:59:59.999`).getTime()

  return (
    <div
      className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto ${pagePaddingTop} ${pagePaddingBottom}`}
    >
      <div className="w-full min-w-0 space-y-4 lg:space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Historical Behavioral Analytics
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Review your baby&apos;s sleep and health patterns over time.
            </p>
            {loadState === 'loading' && (
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                Loading historical data…
              </p>
            )}
            {loadState === 'error' && (
              <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                {loadError}
              </p>
            )}
            {loadState === 'ready' && allRows.length === 0 && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                No analytics data available. Check that the CSV exists at{' '}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">public/data/enriched_baby_monitoring_data.csv</code>{' '}
                and column headers match the expected format.
              </p>
            )}
            {loadState === 'ready' &&
              allRows.length > 0 &&
              !needsCustomDateSelection &&
              !hasInvalidCustomRange &&
              analytics.meta.rowCount === 0 && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  No data for selected filters. Try another period or reset secondary filters to
                  &quot;All&quot; options.
                </p>
              )}
            {ANALYTICS_VALIDATION_DEBUG && loadState === 'ready' && validation && (
              <div className="mt-3 rounded-lg border border-dashed border-amber-300/80 bg-amber-50/50 px-3 py-2 text-[11px] text-slate-700 dark:border-amber-600/50 dark:bg-amber-950/20 dark:text-slate-300">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Dev validation (CSV)
                </p>
                <dl className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="inline text-slate-500">Total rows loaded:</dt>{' '}
                    <dd className="inline font-mono">{validation.totalRowsLoaded}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Filtered rows:</dt>{' '}
                    <dd className="inline font-mono">{validation.filteredRowCount}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Crying rows:</dt>{' '}
                    <dd className="inline font-mono">{validation.cryingRowCount}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Wet &amp; crying:</dt>{' '}
                    <dd className="inline font-mono">{validation.wetAndCryingCount}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Other crying:</dt>{' '}
                    <dd className="inline font-mono">{validation.otherCryingCount}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Avg ambient (°C):</dt>{' '}
                    <dd className="inline font-mono">
                      {validation.avgAmbientTempCelsius ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Avg cry duration (s):</dt>{' '}
                    <dd className="inline font-mono">
                      {validation.avgCryDurationSeconds ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Avg cry duration (min):</dt>{' '}
                    <dd className="inline font-mono">
                      {validation.avgCryDurationMinutes ?? '—'}
                    </dd>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <dt className="inline text-slate-500">Filter:</dt>{' '}
                    <dd className="inline font-mono">{filterModeLabel(validation.filterMode)}</dd>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <dt className="inline text-slate-500">Filtered time range:</dt>{' '}
                    <dd className="inline break-all font-mono text-[10px]">
                      {validation.minTimestampFiltered ?? '—'} →{' '}
                      {validation.maxTimestampFiltered ?? '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
          <div className="inline-flex rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm dark:border-slate-600 dark:bg-[#1e293b]">
            {tabs.map((t) => {
              const Icon = t.icon
              const active = filter === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilter(t.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-cyan-400 text-slate-900 shadow-sm dark:bg-cyan-500 dark:text-slate-950'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2} />}
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {filter === 'custom' && (
          <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b]">
            {/* Explicit custom date range controls for the Custom tab mode. */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  From Date
                </span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  To Date
                </span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>
            </div>
            {needsCustomDateSelection && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Select both start and end dates to view custom-range analytics.
              </p>
            )}
            {hasInvalidCustomRange && (
              <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                Start date must not be after end date.
              </p>
            )}
          </div>
        )}

        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Day of Week
              </span>
              <select
                value={advancedFilters.dayOfWeek}
                onChange={(e) => handleAdvancedFilterChange('dayOfWeek', e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              >
                {dayOfWeekOptions.map((value) => (
                  <option key={value} value={value}>
                    {value === 'all' ? 'All Days' : value}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Time of Day
              </span>
              <select
                value={advancedFilters.timeOfDay}
                onChange={(e) => handleAdvancedFilterChange('timeOfDay', e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              >
                {timeOfDayOptions.map((value) => (
                  <option key={value} value={value}>
                    {value === 'all' ? 'All Periods' : value}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Cry Severity
              </span>
              <select
                value={advancedFilters.crySeverity}
                onChange={(e) => handleAdvancedFilterChange('crySeverity', e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              >
                {crySeverityOptions.map((value) => (
                  <option key={value} value={value}>
                    {value === 'all' ? 'All Severity' : value}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Temperature Category
              </span>
              <select
                value={advancedFilters.tempCategory}
                onChange={(e) => handleAdvancedFilterChange('tempCategory', e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-cyan-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              >
                {tempCategoryOptions.map((value) => (
                  <option key={value} value={value}>
                    {value === 'all' ? 'All Temperature' : value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {(selectedWeekday || selectedDonutSegment) && (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Active selection:</span>
            {selectedWeekday && (
              <button
                type="button"
                onClick={() => setSelectedWeekday(null)}
                className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 font-medium text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300"
              >
                Day: {selectedWeekday} ×
              </button>
            )}
            {selectedDonutSegment && (
              <button
                type="button"
                onClick={() => setSelectedDonutSegment(null)}
                className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
              >
                Segment: {selectedDonutSegment === 'wetCrying' ? 'Wet & Crying' : 'Other Crying'} ×
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-5">
          {/* Cry status by day */}
          <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
            <div className="mb-4 flex items-start justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Cry Status by Day
              </span>
              <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-semibold text-red-500 dark:bg-red-500/10 dark:text-red-400">
                {cryBadgeText}
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalEpisodes}{' '}
              <span className="text-base font-semibold text-slate-500 dark:text-slate-400">
                episodes total
              </span>
            </p>
            <div className="mt-5 h-[240px] min-w-0 w-full lg:mt-6 lg:h-[260px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={cryByDay} margin={{ top: 8, right: 4, left: -16, bottom: 4 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={dark ? '#334155' : '#f1f5f9'}
                  />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: dark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                  />
                  <YAxis hide />
                  <Bar dataKey="episodes" fill="#67e8f9" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {cryByDay.map((entry) => {
                      const isActive = selectedWeekday === entry.day
                      const hasSelection = Boolean(selectedWeekday)
                      return (
                        <Cell
                          key={`cry-day-cell-${entry.day}`}
                          fill={isActive ? '#06b6d4' : '#67e8f9'}
                          fillOpacity={hasSelection && !isActive ? 0.4 : 1}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleWeekdayBarClick(entry.day)}
                        />
                      )
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Temp & crying correlation (historical) */}
          <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
            <div className="mb-4 flex items-start justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Temp & Crying Correlation
              </span>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                {stabilityBadgeText}
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {tempBadge}{' '}
              <span className="text-base font-semibold text-slate-500 dark:text-slate-400">
                Avg Ambient
              </span>
            </p>
            <div className="mt-5 h-[240px] min-w-0 w-full lg:mt-6 lg:h-[260px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ComposedChart data={analyticsTempSeries} margin={{ top: 8, right: 4, left: -4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="tempFillAnalytics" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={dark ? '#22d3ee' : '#94a3b8'}
                        stopOpacity={dark ? 0.2 : 0.25}
                      />
                      <stop
                        offset="100%"
                        stopColor={dark ? '#0f172a' : '#ffffff'}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={dark ? '#334155' : '#f1f5f9'}
                  />
                  <XAxis
                    dataKey="x"
                    type="number"
                    hide
                  />
                  <YAxis domain={tempYDomain} hide />
                  <Area
                    type="monotone"
                    dataKey="temp"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    fill="url(#tempFillAnalytics)"
                    dot={false}
                  />
                  <Scatter
                    data={cryIncidents}
                    dataKey="y"
                    fill="#ef4444"
                    shape={CryIncidentMarker}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-6 text-[11px] font-medium text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                Temperature
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Cry Incident
              </span>
            </div>
          </div>

          {/* Crying & wet donut */}
          <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Crying & Wet Status
              </span>
            </div>
            <div className="relative mx-auto h-[260px] w-full min-w-0 max-w-[min(100%,300px)] lg:h-[280px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={cryingWetDonut}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="62%"
                    outerRadius="88%"
                    strokeWidth={0}
                    paddingAngle={1}
                    onClick={(entry) => handleDonutClick(entry?.name)}
                  >
                    {cryingWetDonut.map((e, i) => {
                      const key = donutSegmentKey(e.name)
                      const isActive = key !== null && selectedDonutSegment === key
                      const hasSelection = Boolean(selectedDonutSegment)
                      return (
                        <Cell
                          key={`${e.name}-${i}`}
                          fill={e.color}
                          fillOpacity={hasSelection && !isActive ? 0.35 : 1}
                          stroke={isActive ? (dark ? '#e2e8f0' : '#0f172a') : 'none'}
                          strokeWidth={isActive ? 2 : 0}
                          style={{ cursor: key ? 'pointer' : 'default' }}
                          onClick={() => handleDonutClick(e.name)}
                        />
                      )
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {correlationDisplay}%
                </p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Correlation
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-col gap-2 text-xs font-medium">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                Wet & Crying - {legendWetCry} recorded events
              </span>
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-yellow-400" />
                Other Crying - {legendOtherCry} recorded events
              </span>
            </div>
          </div>

          {/* Daily average cry duration */}
          <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
            <div className="mb-4 flex items-start justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Daily Average Cry Duration
              </span>
              <span className={trendClass}>{trendLabel}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {avgMinDisplay}{' '}
              <span className="text-base font-semibold text-slate-500 dark:text-slate-400">
                min avg per day
              </span>
            </p>
            <div className="mt-5 h-[260px] min-w-0 w-full lg:mt-6 lg:h-[280px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={dailyAvgCryMin} margin={{ top: 8, right: 4, left: -4, bottom: 4 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={dark ? '#334155' : '#f1f5f9'}
                  />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: dark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    ticks={durationTicks}
                    domain={[0, yMaxDuration]}
                    tick={{ fill: dark ? '#94a3b8' : '#94a3b8', fontSize: 11 }}
                    width={32}
                  />
                  <Bar dataKey="min" fill="#67e8f9" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              Average Daily Cry Duration (min)
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Key Insights
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                Analytical Summary
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
              <Sparkles className="h-3 w-3" />
              Live with active filters
            </span>
          </div>

          {insights?.hasData ? (
            <div className="space-y-2.5">
              {insights.lines.slice(0, -1).map((line, idx) => (
                <div
                  key={`insight-observation-${idx}`}
                  className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-cyan-500 shadow-sm dark:bg-slate-800 dark:text-cyan-300">
                    <Lightbulb className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{line}</p>
                </div>
              ))}

              <div className="rounded-xl border border-cyan-200/80 bg-cyan-50/70 px-3 py-3 dark:border-cyan-500/30 dark:bg-cyan-500/10">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                  Action Suggestion
                </p>
                <div className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" />
                  <p className="text-sm font-medium leading-relaxed text-cyan-900 dark:text-cyan-100">
                    {insights.lines[insights.lines.length - 1]}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No insights available for the current filter and chart selections.
            </p>
          )}
        </div>

        {ANALYTICS_VALIDATION_DEBUG && loadState === 'ready' && validation && (
          <div className="space-y-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-xs dark:border-slate-600 dark:bg-slate-900/40">
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Validation tables (same processed data as charts)
            </p>

            <div>
              <p className="mb-1 font-medium text-slate-600 dark:text-slate-400">
                Cry Status by Day → BarChart data
              </p>
              <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[280px] border-collapse font-mono text-[11px]">
                  <thead>
                    <tr className="bg-white dark:bg-slate-800">
                      <th className="border border-slate-200 px-2 py-1 text-left dark:border-slate-700">
                        day
                      </th>
                      <th className="border border-slate-200 px-2 py-1 text-left dark:border-slate-700">
                        episodes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.chartCryStatusByDay.map((row) => (
                      <tr key={row.day}>
                        <td className="border border-slate-200 px-2 py-0.5 dark:border-slate-700">
                          {row.day}
                        </td>
                        <td className="border border-slate-200 px-2 py-0.5 dark:border-slate-700">
                          {row.episodes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="mb-1 font-medium text-slate-600 dark:text-slate-400">
                Temp &amp; Crying — Area data (x, temp °C)
              </p>
              <div className="max-h-40 overflow-auto rounded border border-slate-200 dark:border-slate-700">
                <table className="w-full border-collapse font-mono text-[11px]">
                  <thead className="sticky top-0 bg-white dark:bg-slate-800">
                    <tr>
                      <th className="border border-slate-200 px-2 py-1 text-left dark:border-slate-700">
                        x
                      </th>
                      <th className="border border-slate-200 px-2 py-1 text-left dark:border-slate-700">
                        temp
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.chartTempLinePoints.map((row, i) => (
                      <tr key={`line-${i}-${row.x}`}>
                        <td className="border border-slate-200 px-2 py-0.5 dark:border-slate-700">
                          {row.x}
                        </td>
                        <td className="border border-slate-200 px-2 py-0.5 dark:border-slate-700">
                          {row.temp}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mb-1 mt-3 font-medium text-slate-600 dark:text-slate-400">
                Temp &amp; Crying — Scatter (cry day markers: x, y °C)
              </p>
              <div className="max-h-32 overflow-auto rounded border border-slate-200 dark:border-slate-700">
                <table className="w-full border-collapse font-mono text-[11px]">
                  <thead className="sticky top-0 bg-white dark:bg-slate-800">
                    <tr>
                      <th className="border border-slate-200 px-2 py-1 text-left dark:border-slate-700">
                        x
                      </th>
                      <th className="border border-slate-200 px-2 py-1 text-left dark:border-slate-700">
                        y
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.chartTempScatterPoints.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="border border-slate-200 px-2 py-1 text-slate-500 dark:border-slate-700"
                        >
                          (none)
                        </td>
                      </tr>
                    ) : (
                      validation.chartTempScatterPoints.map((row, i) => (
                        <tr key={`sc-${i}-${row.x}`}>
                          <td className="border border-slate-200 px-2 py-0.5 dark:border-slate-700">
                            {row.x}
                          </td>
                          <td className="border border-slate-200 px-2 py-0.5 dark:border-slate-700">
                            {row.y}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="mb-1 font-medium text-slate-600 dark:text-slate-400">
                Donut — counts (wet vs other crying)
              </p>
              <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[200px] border-collapse font-mono text-[11px]">
                  <tbody>
                    <tr>
                      <td className="border border-slate-200 px-2 py-1 dark:border-slate-700">
                        wetAndCrying
                      </td>
                      <td className="border border-slate-200 px-2 py-1 dark:border-slate-700">
                        {validation.chartDonutCounts.wetAndCrying}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 px-2 py-1 dark:border-slate-700">
                        otherCrying
                      </td>
                      <td className="border border-slate-200 px-2 py-1 dark:border-slate-700">
                        {validation.chartDonutCounts.otherCrying}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="mb-1 font-medium text-slate-600 dark:text-slate-400">
                Daily Avg Cry Duration — BarChart data (min per weekday)
              </p>
              <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[280px] border-collapse font-mono text-[11px]">
                  <thead>
                    <tr className="bg-white dark:bg-slate-800">
                      <th className="border border-slate-200 px-2 py-1 text-left dark:border-slate-700">
                        day
                      </th>
                      <th className="border border-slate-200 px-2 py-1 text-left dark:border-slate-700">
                        min
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.chartDailyAvgCryMinByWeekday.map((row) => (
                      <tr key={row.day}>
                        <td className="border border-slate-200 px-2 py-0.5 dark:border-slate-700">
                          {row.day}
                        </td>
                        <td className="border border-slate-200 px-2 py-0.5 dark:border-slate-700">
                          {row.min}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      <AnalyticsChatbot context={chatbotContext} />
    </div>
  )
}
