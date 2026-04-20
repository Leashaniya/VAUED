import { useEffect, useMemo, useState } from 'react'
import { Activity, Droplets, Thermometer, Shield, FileText } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Pie,
  PieChart,
  LabelList,
} from 'recharts'
import { StatCard } from '../components/StatCard'
import { LiveBadge, TodayPill } from '../components/LiveBadge'
import { pagePaddingBottom, pagePaddingTop } from '../constants/layout'
import { fetchLiveDashboardData } from '../services/liveDashboardService'
import { buildDashboardChatbotContext } from '../utils/buildChatbotContext'
import { AnalyticsChatbot } from '../components/AnalyticsChatbot'

const POLL_MS = 5000

const EMPTY_LIVE = {
  cards: {
    cry: { value: '—', footer: 'Awaiting live data', footerGood: false },
    wet: { value: '—', footer: 'Awaiting live data' },
    temp: { value: '—', footer: 'Awaiting live data' },
    danger: { value: '—', footer: 'Awaiting live data', footerGood: false },
  },
  charts: {
    hourlySoundData: [{ i: 0, tick: 'Now', value: 0, highlight: false }],
    tempCorrelationLive: [{ t: 'Now', temp: 0 }],
    diaperStats: { wet: 0, dry: 0, wetPct: 0 },
    avgCryDurationMin: 0,
  },
  liveGuidance: '',
  lastUpdatedLabel: 'Last updated: --',
}

function barFill(entry, dark) {
  if (entry.highlight) return 'var(--sbm-accent)'
  return dark ? '#334155' : '#e2e8f0'
}

function SoundBarLabels(props, rows) {
  const { x, y, width, index } = props
  const entry = rows[index]
  if (!entry) return null
  if (entry.loud) {
    return (
      <text
        x={x + width / 2}
        y={y - 8}
        textAnchor="middle"
        fill="#64748b"
        className="text-[10px] font-semibold dark:fill-slate-400"
        fontSize={10}
      >
        Loud
      </text>
    )
  }
  if (entry.active) {
    return (
      <text
        x={x + width / 2}
        y={y - 8}
        textAnchor="middle"
        fill="#64748b"
        fontSize={10}
        className="font-semibold dark:fill-slate-400"
      >
        Active
      </text>
    )
  }
  return null
}

const DASHBOARD_CHAT_INTRO =
  'I read the same live cards and charts you see here (sound, wetness, temperature, danger, alerts). Ask what a status means, whether to check the nursery, or how thresholds work — calmly and without medical advice. For week-over-week trends, open Analytics.'

const DASHBOARD_QUICK_PROMPTS = [
  'Summarize the current live situation',
  'Are there any active alerts?',
  'What should parents monitor now?',
  'Why is danger status showing attention?',
]

export function Dashboard({ dark, onNotificationsChange, activeBaby = null }) {
  const activeBabyName = typeof activeBaby?.name === 'string' ? activeBaby.name.trim() : ''
  const [live, setLive] = useState(EMPTY_LIVE)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    let timer = null

    async function refresh() {
      try {
        const next = await fetchLiveDashboardData({
          babyName: activeBabyName || '',
        })
        if (cancelled) return
        setLive(next)
        onNotificationsChange?.(next.notifications ?? [])
        setLoadError('')
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e?.message?.includes('failed') || e?.message?.includes('API')
              ? 'Live feed temporarily unavailable. Retrying automatically…'
              : e?.message || 'Live feed temporarily unavailable. Retrying…',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          timer = setTimeout(refresh, POLL_MS)
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.log('[Dashboard LIVE] polling refresh', { pollMs: POLL_MS })
          }
        }
      }
    }

    refresh()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [onNotificationsChange, activeBabyName])

  const hourlySoundData = live.charts.hourlySoundData
  const tempCorrelationLive = live.charts.tempCorrelationLive
  const diaperStats = live.charts.diaperStats
  const avgCryDurationMin = live.charts.avgCryDurationMin
  const LAST_UPDATED = loading ? 'Loading live data...' : live.lastUpdatedLabel

  const donutData = useMemo(
    () => [
      { name: 'Wet', value: diaperStats.wetPct, fill: 'var(--sbm-accent, #22d3ee)' },
      { name: 'Dry', value: 100 - diaperStats.wetPct, fill: dark ? '#334155' : '#e2e8f0' },
    ],
    [diaperStats.wetPct, dark],
  )

  const soundLabelRenderer = (props) => SoundBarLabels(props, hourlySoundData)

  const dashboardChatbotContext = useMemo(
    () =>
      buildDashboardChatbotContext({
        live,
        activeBaby,
        loading,
        loadError,
      }),
    [live, activeBaby, loading, loadError],
  )

  return (
    <div
      className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto ${pagePaddingTop} ${pagePaddingBottom}`}
    >
      <div className="w-full min-w-0 space-y-4 lg:space-y-5">
        {loading && !loadError && (
          <p className="rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
            Waiting for live sensor data…
          </p>
        )}
        {loadError && (
          <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {loadError}
          </p>
        )}
        {live.liveGuidance && !loadError && (
          <p
            className="rounded-lg border px-3 py-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300"
            style={{
              borderColor: 'var(--sbm-accent-soft)',
              backgroundColor: 'var(--sbm-accent-soft)',
              color: 'var(--sbm-accent-text)',
            }}
          >
            {live.liveGuidance}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Activity}
            iconClass="bg-violet-50 text-violet-500 dark:bg-violet-500/15 dark:text-violet-400"
            label="Cry Status"
            value={live.cards.cry.value}
            footer={live.cards.cry.footer}
            footerClass={
              live.cards.cry.footerGood
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }
            showCheck={Boolean(live.cards.cry.footerGood)}
          />
          <StatCard
            icon={Droplets}
            iconClass="bg-cyan-50 text-cyan-500 dark:bg-cyan-500/15 dark:text-cyan-400"
            label="Wet Status"
            value={live.cards.wet.value}
            footer={live.cards.wet.footer}
          />
          <StatCard
            icon={Thermometer}
            iconClass="bg-orange-50 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400"
            label="Temperature"
            value={live.cards.temp.value}
            footer={live.cards.temp.footer}
          />
          <StatCard
            icon={Shield}
            iconClass="bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400"
            label="Danger Status"
            value={live.cards.danger.value}
            footer={live.cards.danger.footer}
            footerClass={
              live.cards.danger.footerGood
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }
            showCheck={Boolean(live.cards.danger.footerGood)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:gap-5">
          <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Hourly Sound Intensity
              </h2>
              <LiveBadge />
              <TodayPill />
            </div>
            <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">{LAST_UPDATED}</p>
            <div className="h-[300px] w-full min-w-0 lg:h-[320px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={hourlySoundData}
                  margin={{ top: 28, right: 4, left: -12, bottom: 4 }}
                  barCategoryGap="18%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={dark ? '#334155' : '#f1f5f9'}
                  />
                  <XAxis
                    dataKey="i"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tick={({ x, y, payload }) => {
                      const row = hourlySoundData.find((d) => String(d.i) === String(payload.value))
                      const label = row?.tick
                      if (!label) return null
                      return (
                        <text
                          x={x}
                          y={y + 14}
                          textAnchor="middle"
                          fill={dark ? '#94a3b8' : '#64748b'}
                          fontSize={11}
                        >
                          {label}
                        </text>
                      )
                    }}
                  />
                  <YAxis hide domain={[0, 'dataMax + 20']} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={28}>
                    {hourlySoundData.map((entry, i) => (
                      <Cell key={i} fill={barFill(entry, dark)} />
                    ))}
                    <LabelList content={soundLabelRenderer} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                Temp & Crying Correlation
              </h2>
              <LiveBadge />
              <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                Temp
              </span>
            </div>
            <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">{LAST_UPDATED}</p>
            <div className="h-[300px] w-full min-w-0 lg:h-[320px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart
                  data={tempCorrelationLive}
                  margin={{ top: 8, right: 4, left: -12, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="tempFillDash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--sbm-accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--sbm-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#f1f5f9'} />
                  <XAxis
                    dataKey="t"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: dark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                  />
                  <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                  <Area
                    type="monotone"
                    dataKey="temp"
                    stroke="var(--sbm-accent)"
                    strokeWidth={2.5}
                    fill="url(#tempFillDash)"
                    dot={false}
                    activeDot={{ r: 4, fill: 'var(--sbm-accent)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.88fr_1.12fr] lg:gap-5">
          <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Today&apos;s Diaper Stats
              </h2>
              <LiveBadge />
            </div>
            <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">{LAST_UPDATED}</p>
            <div className="relative mx-auto h-[260px] w-full min-w-0 max-w-[min(100%,320px)] lg:h-[280px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="68%"
                    outerRadius="88%"
                    strokeWidth={0}
                    paddingAngle={2}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {diaperStats.wetPct}%
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Wet Events
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-6 text-xs font-medium">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--sbm-accent)' }} />
                Wet: {diaperStats.wet} today
              </span>
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span className={`h-2 w-2 rounded-full ${dark ? 'bg-slate-600' : 'bg-slate-300'}`} />
                Dry: {diaperStats.dry} today
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2 lg:mb-5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                Average Cry Duration (Live)
              </h2>
              <LiveBadge />
              <span
                className="ml-auto rounded-full px-3 py-1 text-[10px] font-semibold"
                style={{ backgroundColor: 'var(--sbm-accent-soft)', color: 'var(--sbm-accent-text)' }}
              >
                Avg: {avgCryDurationMin.toFixed(1)}m
              </span>
            </div>
            <p className="mb-6 text-xs text-slate-400 dark:text-slate-500 lg:mb-7">{LAST_UPDATED}</p>
            <div className="flex flex-col items-center justify-center py-2 lg:py-4">
              <p className="text-center text-5xl font-bold tracking-tight text-slate-900 dark:text-white lg:text-6xl">
                {avgCryDurationMin.toFixed(1)}{' '}
                <span style={{ color: 'var(--sbm-accent)' }}>mins</span>
              </p>
              <div
                className="mt-8 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: 'var(--sbm-accent-soft)', color: 'var(--sbm-accent-text)' }}
              >
                <FileText className="h-3.5 w-3.5" strokeWidth={2} />
                Daily Average
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnalyticsChatbot
        context={dashboardChatbotContext}
        launcherLabel="Live assistant"
        panelTitle="Live monitor assistant"
        introMessage={DASHBOARD_CHAT_INTRO}
        quickPrompts={DASHBOARD_QUICK_PROMPTS}
        inputPlaceholder="Ask about live status, alerts, or charts…"
      />
    </div>
  )
}
