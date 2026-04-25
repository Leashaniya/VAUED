import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { pagePaddingBottom, pagePaddingTop } from '../constants/layout'
import { IOT_API_BASE_URL, mlReadingsFetch } from '../config/iotApiBase'

function formatForecastDateLabel(iso) {
  if (!iso || typeof iso !== 'string') return '—'
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function MlInsights({ dark }) {
  const [forecastData, setForecastData] = useState(null)
  const [forecastError, setForecastError] = useState('')
  const [featureImportance, setFeatureImportance] = useState(null)
  const [featureError, setFeatureError] = useState('')
  const [anomalyStatus, setAnomalyStatus] = useState(null)
  const [anomalyError, setAnomalyError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function readJsonOrDetail(res) {
      const text = await res.text()
      try {
        const j = JSON.parse(text)
        if (!res.ok) {
          const detail =
            j && typeof j === 'object' && j.error != null ? String(j.error) : text.slice(0, 160) || `HTTP ${res.status}`
          return { ok: false, data: null, detail }
        }
        return { ok: true, data: j, detail: '' }
      } catch {
        if (!res.ok) {
          return { ok: false, data: null, detail: text.slice(0, 160) || `HTTP ${res.status}` }
        }
        return { ok: false, data: null, detail: 'Invalid JSON from server' }
      }
    }

    async function loadForecast() {
      try {
        const res = await mlReadingsFetch('/api/readings/ml/forecast')
        const { ok, data, detail } = await readJsonOrDetail(res)
        if (cancelled) return
        if (!ok) {
          setForecastError(detail || `HTTP ${res.status}`)
          return
        }
        setForecastData(data)
        setForecastError('')
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof TypeError && e.message === 'Failed to fetch' ? 'Network error' : String(e?.message || e)
          setForecastError(msg)
        }
      }
    }

    async function loadFeatureImportance() {
      try {
        const res = await mlReadingsFetch('/api/readings/ml/feature-importance')
        const { ok, data, detail } = await readJsonOrDetail(res)
        if (cancelled) return
        if (!ok) {
          setFeatureError(detail || `HTTP ${res.status}`)
          return
        }
        setFeatureImportance(data)
        setFeatureError('')
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof TypeError && e.message === 'Failed to fetch' ? 'Network error' : String(e?.message || e)
          setFeatureError(msg)
        }
      }
    }

    async function loadAnomalyStatus() {
      try {
        const res = await mlReadingsFetch('/api/readings/ml/anomaly-status')
        const { ok, data, detail } = await readJsonOrDetail(res)
        if (cancelled) return
        if (!ok) {
          setAnomalyError(detail || `HTTP ${res.status}`)
          return
        }
        setAnomalyStatus(data)
        setAnomalyError('')
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof TypeError && e.message === 'Failed to fetch' ? 'Network error' : String(e?.message || e)
          setAnomalyError(msg)
        }
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

  /** Daily cry count (bars) + mean temperature °C (line) by calendar date; last bar = model next-day prediction. */
  const forecastChartRows = useMemo(() => {
    const series = forecastData?.last_7_days_series
    if (Array.isArray(series) && series.length > 0) {
      const historical = series.map((row) => ({
        dateIso: row.date,
        label: formatForecastDateLabel(row.date),
        cryCount: Number(row.cry_count) || 0,
        avgTemp: Number.isFinite(Number(row.avg_temperature)) ? Number(row.avg_temperature) : null,
        avgTempEstimated: false,
        predicted: false,
      }))
      const nextIso = forecastData?.next_day_date
      const nextPred = forecastData?.next_day_predicted_cries
      if (nextIso && Number.isFinite(Number(nextPred))) {
        const nextTemp = forecastData?.next_day_predicted_avg_temperature
        historical.push({
          dateIso: nextIso,
          label: formatForecastDateLabel(nextIso),
          cryCount: Number(nextPred) || 0,
          avgTemp: Number.isFinite(Number(nextTemp)) ? Number(nextTemp) : null,
          avgTempEstimated: Number.isFinite(Number(nextTemp)),
          predicted: true,
        })
      }
      return historical
    }
    const actual = Array.isArray(forecastData?.last_7_days) ? forecastData.last_7_days : []
    const rows = actual.map((value, idx) => ({
      dateIso: null,
      label: `D${idx + 1}`,
        cryCount: Number(value) || 0,
        avgTemp: null,
        avgTempEstimated: false,
        predicted: false,
      }))
    if (forecastData && Number.isFinite(Number(forecastData.next_day_predicted_cries))) {
      const nt = forecastData?.next_day_predicted_avg_temperature
      rows.push({
        dateIso: null,
        label: 'Tmr',
        cryCount: Number(forecastData.next_day_predicted_cries) || 0,
        avgTemp: Number.isFinite(Number(nt)) ? Number(nt) : null,
        avgTempEstimated: Number.isFinite(Number(nt)),
        predicted: true,
      })
    }
    return rows
  }, [forecastData])

  const featureRows = useMemo(() => {
    if (!featureImportance || typeof featureImportance !== 'object') return []
    const entries = Object.entries(featureImportance).filter(([name]) => name !== 'humidity')
    const raw = entries.map(([name, value]) => ({ name, value: Number(value) || 0 }))
    const sum = raw.reduce((s, r) => s + r.value, 0)
    const norm = sum > 0 ? raw.map((r) => ({ ...r, value: r.value / sum })) : raw
    return norm.sort((a, b) => b.value - a.value)
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

  const renderLoadFailure = (detail) => (
    <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
      <p className="rounded-md bg-amber-50 px-2 py-1.5 font-mono text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        {detail}
      </p>
      {import.meta.env.DEV ? (
        <p className="text-[11px] leading-relaxed">
          In dev, the UI calls <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/api/readings/…</code> and
          Vite proxies to <span className="font-mono">{IOT_API_BASE_URL}</span> (set in repo-root{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env.local</code>). Restart{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">npm run dev</code> after editing env.
        </p>
      ) : (
        <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500">API: {IOT_API_BASE_URL}</p>
      )}
      <ul className="list-inside list-disc text-[11px] leading-relaxed">
        <li>
          <code className="font-mono">iot-api</code> on the same host/port as <code className="font-mono">VITE_IOT_API_BASE_URL</code>
        </li>
        <li>
          <code className="font-mono">API_KEY</code> in <code className="font-mono">iot-api/.env</code> must match{' '}
          <code className="font-mono">VITE_IOT_API_KEY</code> in repo-root env (used by the dev proxy)
        </li>
        <li>
          Flask ML server: <code className="font-mono">python ml_server.py</code> (port 5001) — otherwise forecast / features return 503
        </li>
      </ul>
    </div>
  )

  return (
    <div
      className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto ${pagePaddingTop} ${pagePaddingBottom}`}
    >
      <div className="w-full min-w-0 space-y-4 lg:space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">ML insights</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Forecast, cry-model feature importance, and live anomaly status from your sensors (via iot-api → Flask).
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Cry Forecast — Tomorrow
                </p>
                <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">ML Forecast</h2>
              </div>
              {!forecastError && (
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${trendPillStyles}`}>
                  {trendText}
                </span>
              )}
            </div>
            {forecastError ? (
              renderLoadFailure(forecastError)
            ) : (
              <>
                <p className="text-4xl font-bold text-slate-900 dark:text-white">
                  {Number.isFinite(Number(forecastData?.next_day_predicted_cries))
                    ? Number(forecastData.next_day_predicted_cries)
                    : '—'}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Predicted cry episodes for{' '}
                  {forecastData?.next_day_date
                    ? formatForecastDateLabel(forecastData.next_day_date)
                    : 'the next day'}{' '}
                  (from historical daily CSV)
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Bars = crying episodes per day (last day in orange = predicted cries). Purple line = daily average
                  temperature (°C). Last purple point = next-day average °C estimated by a simple trend on the same 7
                  days (not measured in the CSV).
                </p>
                <div className="mt-4 h-[220px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <ComposedChart data={forecastChartRows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={dark ? '#334155' : '#f1f5f9'} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: dark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                        interval={0}
                        height={36}
                      />
                      <YAxis
                        yAxisId="cry"
                        tickLine={false}
                        axisLine={false}
                        width={32}
                        allowDecimals={false}
                        tick={{ fill: dark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                        label={{
                          value: 'Cries',
                          angle: -90,
                          position: 'insideLeft',
                          fill: dark ? '#94a3b8' : '#64748b',
                          fontSize: 10,
                        }}
                      />
                      <YAxis
                        yAxisId="temp"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        width={36}
                        tick={{ fill: dark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                        label={{
                          value: '°C',
                          angle: 90,
                          position: 'insideRight',
                          fill: dark ? '#94a3b8' : '#64748b',
                          fontSize: 10,
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: dark ? '1px solid #334155' : '1px solid #e2e8f0',
                          backgroundColor: dark ? '#1e293b' : '#fff',
                          fontSize: 12,
                        }}
                        labelFormatter={(_, payload) => {
                          const p = payload?.[0]?.payload
                          if (p?.dateIso) return p.dateIso
                          return p?.label ?? ''
                        }}
                        formatter={(value, _name, item) => {
                          const pl = item?.payload
                          const dk = item?.dataKey
                          if (dk === 'cryCount') return [value, 'Cry episodes']
                          if (dk === 'avgTemp') {
                            if (value == null) return ['—', 'Avg temp °C']
                            const suffix = pl?.avgTempEstimated ? ' (estimated)' : ''
                            return [`${value}°C${suffix}`, 'Avg temp °C']
                          }
                          return [value, String(dk ?? '')]
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11, paddingTop: 8, display: 'flex', gap: '1rem', flexWrap: 'wrap' }}
                      />
                      <Bar yAxisId="cry" dataKey="cryCount" radius={[6, 6, 0, 0]} maxBarSize={28} name="Cry episodes">
                        {forecastChartRows.map((entry, idx) => (
                          <Cell key={`fc-${entry.label}-${idx}`} fill={entry.predicted ? '#f59e0b' : 'var(--sbm-accent)'} />
                        ))}
                      </Bar>
                      <Line
                        yAxisId="temp"
                        type="monotone"
                        dataKey="avgTemp"
                        name="Avg temp (°C)"
                        stroke="#a855f7"
                        strokeWidth={2}
                        dot={(props) => {
                          const { cx, cy, payload } = props
                          if (cx == null || cy == null) return null
                          const est = payload?.avgTempEstimated
                          if (est) {
                            return (
                              <circle
                                cx={cx}
                                cy={cy}
                                r={4}
                                fill={dark ? '#1e293b' : '#fff'}
                                stroke="#a855f7"
                                strokeWidth={2}
                              />
                            )
                          }
                          return <circle cx={cx} cy={cy} r={3} fill="#a855f7" />
                        }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Room condition
              </span>
              <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">Anomaly status</h2>
            </div>
            {anomalyError ? (
              renderLoadFailure(anomalyError)
            ) : (
              <div>
                <p
                  className={`text-lg font-semibold ${
                    anomalyStatus?.isAnomaly
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {anomalyStatus?.isAnomaly ? 'Anomaly detected' : 'Normal conditions'}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Score:{' '}
                  {Number.isFinite(Number(anomalyStatus?.score)) ? Number(anomalyStatus.score).toFixed(4) : '—'}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100/80 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-[#1e293b] lg:p-6">
          <div className="mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Cry model
            </span>
            <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">What triggers crying most?</h2>
          </div>
          {featureError ? (
            renderLoadFailure(featureError)
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
      </div>
    </div>
  )
}
