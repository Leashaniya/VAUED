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

const ANALYTICS_CHAT_INTRO =
  'I use your current filters, chart selections, and Key Insights — grounded in this page’s historical CSV view (not live “right now” sensors). Ask about trends, badges, wetness vs crying, or comparisons to the prior window — calmly and without medical advice.'

const ANALYTICS_QUICK_PROMPTS = [
  'Which day has the highest crying?',
  'What changed compared to previous period?',
  'Summarize the current analytics view',
]

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

function getTrendPillAppearance(trend) {
  if (trend === 'worse') {
    return {
      className:
        'shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
      style: undefined,
    }
  }
  return {
    className: 'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
    style: {
      backgroundColor: 'var(--sbm-accent-soft)',
      color: 'var(--sbm-accent-text)',
    },
  }
}

export function Analytics({ dark, filter, setFilter, activeBaby = null }) {
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
  const [forecastData, setForecastData] = useState(null)
  const [forecastError, setForecastError] = useState('')
  const [featureImportance, setFeatureImportance] = useState(null)
  const [featureError, setFeatureError] = useState('')
  const [anomalyStatus, setAnomalyStatus] = useState(null)
  const [anomalyError, setAnomalyError] = useState('')

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
    let cancelled = false

    async function loadForecast() {
      try {
        const res = await fetch('/api/readings/ml/forecast')
        if (!res.ok) throw new Error('forecast unavailable')
        const data = await res.json()
        if (cancelled) return
        setForecastData(data)
        setForecastError('')
      } catch {
        if (!cancelled) setForecastError('ML service not running')
      }
    }

    async function loadFeatureImportance() {
      try {
        const res = await fetch('/api/readings/ml/feature-importance')
        if (!res.ok) throw new Error('feature importance unavailable')
        const data = await res.json()
        if (cancelled) return
        setFeatureImportance(data)
        setFeatureError('')
      } catch {
        if (!cancelled) setFeatureError('ML service not running')
      }
    }

    async function loadAnomalyStatus() {
      try {
        const res = await fetch('/api/readings/ml/anomaly-status')
        if (!res.ok) throw new Error('anomaly unavailable')
        const data = await res.json()
        if (cancelled) return
        setAnomalyStatus(data)
        setAnomalyError('')
      } catch {
        if (!cancelled) setAnomalyError('ML service not running')
      }
    }

    loadForecast()
    loadFeatureImportance()
    loadAnomalyStatus()
    const t = setInterval(loadAnomalyStatus, 30000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

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
  const trendPill = getTrendPillAppearance(badges.trend)

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
  const forecastBars = useMemo(() => {
    const actual = Array.isArray(forecastData?.last_7_days) ? forecastData.last_7_days : []
    const rows = actual.map((value, idx) => ({
      label: `D${idx + 1}`,
      value: Number(value) || 0,
      predicted: false,
    }))
    if (forecastData && Number.isFinite(Number(forecastData.next_day_predicted_cries))) {
      rows.push({
        label: 'Tmr',
        value: Number(forecastData.next_day_predicted_cries) || 0,
        predicted: true,
      })
    }
    return rows
  }, [forecastData])
  const featureRows = useMemo(() => {
    if (!featureImportance || typeof featureImportance !== 'object') return []
    return Object.entries(featureImportance)
      .map(([name, value]) => ({ name, value: Number(value) || 0 }))
      .sort((a, b) => b.value - a.value)
  }, [featureImportance])
  const forecastTrend = String(forecastData?.trend || '').toLowerCase()
  const trendPillStyles =
    forecastTrend === 'increasing'
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
      : forecastTrend === 'decreasing'
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
        : 'text-cyan-700 dark:text-cyan-300'
  const trendText =
    forecastTrend === 'increasing'
      ? '↑ Increasing'
      : forecastTrend === 'decreasing'
        ? '↓ Decreasing'
        : '→ Stable'

  // Build chatbot input from already-processed dashboard state (not raw CSV parsing).
  const chatbotContext = useMemo(
    () =>
      buildAnalyticsChatbotContext({
        rangeMode: filter,
        advancedFilters,
        selections: { selectedWeekday, selectedDonutSegment },
        analytics,
        customRange: { customStartDate, customEndDate },
        activeBaby,
      }),
    [
      filter,
      advancedFilters,
      selectedWeekday,
      selectedDonutSegment,
      analytics,
      customStartDate,
      customEndDate,
      activeBaby,
    ],
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
                      ? 'shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                  style={
                    active
                      ? { backgroundColor: 'var(--sbm-accent)', color: '#0f172a' }
                      : undefined
                  }
                >
                  {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2} />}
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Cry Forecast — Tomorrow
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">ML Forecast</h3>
            </div>
            {!forecastError && (
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${trendPillStyles}`}>
                {trendText}
              </span>
            )}
          </div>
          {forecastError ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">ML service not running</p>
          ) : (
            <>
              <p className="text-4xl font-bold text-slate-900 dark:text-white">
                {Number.isFinite(Number(forecastData?.next_day_predicted_cries))
                  ? Number(forecastData.next_day_predicted_cries)
                  : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Predicted cry episodes tomorrow</p>
              <div className="mt-4 h-[180px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={forecastBars} margin={{ top: 8, right: 4, left: -12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={dark ? '#334155' : '#f1f5f9'} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: dark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                    />
                    <YAxis hide />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={28}>
                      {forecastBars.map((entry, idx) => (
                        <Cell key={`forecast-cell-${idx}`} fill={entry.predicted ? '#f59e0b' : 'var(--sbm-accent)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
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
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-[var(--sbm-accent)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
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
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-[var(--sbm-accent)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
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
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-[var(--sbm-accent)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
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
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-[var(--sbm-accent)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
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
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-[var(--sbm-accent)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
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
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-[var(--sbm-accent)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
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
                className="rounded-full border px-2 py-0.5 font-medium"
                style={{
                  borderColor: 'color-mix(in srgb, var(--sbm-accent) 42%, transparent)',
                  backgroundColor: 'var(--sbm-accent-soft)',
                  color: 'var(--sbm-accent-text)',
                }}
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
                  <Bar dataKey="episodes" fill="var(--sbm-accent)" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {cryByDay.map((entry) => {
                      const isActive = selectedWeekday === entry.day
                      const hasSelection = Boolean(selectedWeekday)
                      return (
                        <Cell
                          key={`cry-day-cell-${entry.day}`}
                          fill="var(--sbm-accent)"
                          fillOpacity={hasSelection && !isActive ? 0.38 : isActive ? 1 : 0.72}
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
                        stopColor="var(--sbm-accent)"
                        stopOpacity={dark ? 0.22 : 0.2}
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
                    stroke="var(--sbm-accent)"
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
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: 'var(--sbm-accent)' }}
                />
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
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: 'var(--sbm-accent)' }}
                />
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
              <span className={trendPill.className} style={trendPill.style}>
                {trendLabel}
              </span>
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
                  <Bar dataKey="min" fill="var(--sbm-accent)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--sbm-accent)' }}
              />
              Average Daily Cry Duration (min)
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
          <div className="mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              What triggers crying most?
            </span>
          </div>
          {featureError ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">ML service not running</p>
          ) : (
            <div className="h-[240px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={featureRows} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={dark ? '#334155' : '#f1f5f9'} />
                  <XAxis type="number" hide domain={[0, 1]} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: dark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                    width={90}
                  />
                  <Bar dataKey="value" fill="var(--sbm-accent)" radius={[0, 6, 6, 0]} maxBarSize={24}>
                    {featureRows.map((entry) => (
                      <Cell key={`fi-${entry.name}`} fill="var(--sbm-accent)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-4">
                {featureRows.map((entry) => (
                  <span key={`fi-label-${entry.name}`}>
                    {entry.name}: {Math.round(entry.value * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
          <div className="mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Room Condition — ML Analysis
            </span>
          </div>
          {anomalyError ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">ML service not running</p>
          ) : (
            <div>
              <p
                className={`text-lg font-semibold ${
                  anomalyStatus?.isAnomaly
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {anomalyStatus?.isAnomaly ? 'Anomaly Detected' : 'Normal Conditions'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Anomaly score:{' '}
                {Number.isFinite(Number(anomalyStatus?.score)) ? Number(anomalyStatus.score).toFixed(4) : '—'}
              </p>
            </div>
          )}
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
            <span
              className="inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-1 text-[10px] font-semibold"
              style={{
                backgroundColor: 'var(--sbm-accent-soft)',
                color: 'var(--sbm-accent-text)',
              }}
            >
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
                  <span
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white shadow-sm dark:bg-slate-800"
                    style={{ color: 'var(--sbm-accent)' }}
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{line}</p>
                </div>
              ))}

              <div
                className="rounded-xl border px-3 py-3"
                style={{
                  borderColor: 'color-mix(in srgb, var(--sbm-accent) 40%, transparent)',
                  backgroundColor: 'var(--sbm-accent-soft)',
                }}
              >
                <p
                  className="mb-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--sbm-accent-text)' }}
                >
                  Action Suggestion
                </p>
                <div className="flex items-start gap-2">
                  <ArrowRight
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: 'var(--sbm-accent-text)' }}
                  />
                  <p
                    className="text-sm font-medium leading-relaxed"
                    style={{ color: 'var(--sbm-accent-text)' }}
                  >
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
      <AnalyticsChatbot
        context={chatbotContext}
        launcherLabel="Analytics assistant"
        panelTitle="Analytics assistant"
        introMessage={ANALYTICS_CHAT_INTRO}
        quickPrompts={ANALYTICS_QUICK_PROMPTS}
        inputPlaceholder="Ask about charts, filters, trends, or insights…"
      />
    </div>
  )
}
