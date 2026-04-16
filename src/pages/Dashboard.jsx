import {
  Activity,
  Droplets,
  Thermometer,
  Shield,
  FileText,
} from 'lucide-react'
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
import {
  hourlySoundData,
  tempCorrelationLive,
  diaperStats,
} from '../data/mockData'
import { pagePaddingBottom, pagePaddingTop } from '../constants/layout'

const LAST_UPDATED = 'Last updated: 07:37 PM'

function barFill(entry, dark) {
  if (entry.highlight) return '#22d3ee'
  return dark ? '#334155' : '#e2e8f0'
}

function SoundBarLabels(props) {
  const { x, y, width, index } = props
  const entry = hourlySoundData[index]
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

export function Dashboard({ dark }) {
  const donutData = [
    { name: 'Wet', value: diaperStats.wetPct, fill: '#22d3ee' },
    { name: 'Dry', value: 100 - diaperStats.wetPct, fill: dark ? '#334155' : '#e2e8f0' },
  ]

  return (
    <div
      className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto ${pagePaddingTop} ${pagePaddingBottom}`}
    >
      <div className="w-full min-w-0 space-y-4 lg:space-y-5">
        {/* Stat row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Activity}
            iconClass="bg-violet-50 text-violet-500 dark:bg-violet-500/15 dark:text-violet-400"
            label="Cry Status"
            value="Calm"
            footer="Deep sleep detected"
            footerClass="text-emerald-600 dark:text-emerald-400"
            showCheck
          />
          <StatCard
            icon={Droplets}
            iconClass="bg-cyan-50 text-cyan-500 dark:bg-cyan-500/15 dark:text-cyan-400"
            label="Wet Status"
            value="Dry"
            footer="Sensor active & secure"
          />
          <StatCard
            icon={Thermometer}
            iconClass="bg-orange-50 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400"
            label="Temperature"
            value="72.4°F"
            footer="Target: 70°F - 74°F"
          />
          <StatCard
            icon={Shield}
            iconClass="bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400"
            label="Danger Status"
            value="Secure"
            footer="No safety hazards detected"
            footerClass="text-emerald-600 dark:text-emerald-400"
            showCheck
          />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:gap-5">
          <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Hourly Sound Intensity
              </h2>
              <LiveBadge />
              <TodayPill />
            </div>
            <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
              {LAST_UPDATED}
            </p>
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
                      const row = hourlySoundData.find(
                        (d) => String(d.i) === String(payload.value),
                      )
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
                  <YAxis hide domain={[0, 65]} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={28}>
                    {hourlySoundData.map((entry, i) => (
                      <Cell key={i} fill={barFill(entry, dark)} />
                    ))}
                    <LabelList content={SoundBarLabels} />
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
            <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
              {LAST_UPDATED}
            </p>
            <div className="h-[300px] w-full min-w-0 lg:h-[320px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart
                  data={tempCorrelationLive}
                  margin={{ top: 8, right: 4, left: -12, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="tempFillDash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={dark ? '#334155' : '#f1f5f9'}
                  />
                  <XAxis
                    dataKey="t"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: dark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                  />
                  <YAxis hide domain={[68, 75]} />
                  <Area
                    type="monotone"
                    dataKey="temp"
                    stroke="#22d3ee"
                    strokeWidth={2.5}
                    fill="url(#tempFillDash)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#22d3ee' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.88fr_1.12fr] lg:gap-5">
          <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Today&apos;s Diaper Stats
              </h2>
              <LiveBadge />
            </div>
            <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
              {LAST_UPDATED}
            </p>
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
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                Wet: {diaperStats.wet} today
              </span>
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span
                  className={`h-2 w-2 rounded-full ${dark ? 'bg-slate-600' : 'bg-slate-300'}`}
                />
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
              <span className="ml-auto rounded-full bg-cyan-100 px-3 py-1 text-[10px] font-semibold text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300">
                Avg: 4.2m
              </span>
            </div>
            <p className="mb-6 text-xs text-slate-400 dark:text-slate-500 lg:mb-7">
              {LAST_UPDATED}
            </p>
            <div className="flex flex-col items-center justify-center py-2 lg:py-4">
              <p className="text-center text-5xl font-bold tracking-tight text-slate-900 dark:text-white lg:text-6xl">
                4.2{' '}
                <span className="text-cyan-500 dark:text-cyan-400">mins</span>
              </p>
              <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-cyan-100 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-cyan-800 dark:bg-cyan-500/25 dark:text-cyan-200">
                <FileText className="h-3.5 w-3.5" strokeWidth={2} />
                Daily Average
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
