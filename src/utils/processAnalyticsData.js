/**
 * Historical baby monitor CSV → chart-ready datasets for the Analytics page only.
 *
 * CSV location (Vite): place the file at `public/data/enriched_baby_monitoring_data.csv`
 * so it is served at `/data/enriched_baby_monitoring_data.csv` (works in dev and production build).
 *
 * Column expectations (enriched schema used by analytics):
 * start_timestamp, end_timestamp, cry_status, cry_duration, temperature, wet_status,
 * date, day_of_week, hour_of_day, time_of_day, cry_severity, temp_category
 *
 * NOTE:
 * - `duration_minutes`, `is_crying`, and `is_wet` may still exist in CSV, but analytics intentionally
 *   ignores them and derives from cry_status/cry_duration/wet_status for consistency.
 *
 * -----------------------------------------------------------------------------
 * CHART FORMULAS (filtered rows = rows after 7d / 30d / custom filter; crying = normalized flag)
 * -----------------------------------------------------------------------------
 *
 * 1) Cry Status by Day (BarChart `episodes`)
 *    For each weekday label Mon..Sun: count filtered rows where crying && weekday(start) = that day.
 *    weekday = Monday-first index from Date (see mondayFirstWeekdayIndex).
 *
 * 2) Temp & Crying Correlation (Area + Scatter)
 *    Group filtered rows by calendar date (local date of start_timestamp).
 *    Line points: one per day, x = 0..N-1 in chronological order, temp = mean(temperature) that day (rows with null temp skipped from mean).
 *    Scatter (cry incidents): same x index, y = same daily mean temp, only for days where ≥1 row has crying.
 *
 * 3) Crying & Wet Status (Donut)
 *    Among crying rows only: wetAndCrying = count(wet), otherCrying = count(!wet).
 *    Center % = round(wetAndCrying / (wetAndCrying + otherCrying) * 100). Pie uses those counts as slice values.
 *
 * 4) Daily Average Cry Duration (BarChart `min`)
 *    For each weekday Mon..Sun: among crying rows on that weekday, min = mean(cry_duration in seconds) / 60, rounded 1 decimal.
 *
 * 5) Headline “min avg per day” (card text, not the weekday bar chart)
 *    Sum over crying rows: (cry_duration_sec / 60) / (number of distinct calendar days in filtered set).
 *
 * 6) Average ambient temperature (card)
 *    Mean of `temperature` over all filtered rows (null temps excluded from mean).
 *
 * 7) Average cry duration (validation / debug)
 *    Mean of cry_duration (seconds) over crying rows in filtered set.
 *
 * 8) Period comparison (chatbot + reasoning)
 *    `comparison` object: current vs previous **equivalent time span** (see previousWindowRows),
 *    with the **same** advanced filters + chart selections applied to both slices.
 *    Deltas: episode count diff, wet-share **percentage points** among cries, mean temp diff,
 *    headline avg cry minutes/day diff; `strongestFactor` picks the largest normalized move.
 * -----------------------------------------------------------------------------
 */

import Papa from 'papaparse'

/** Public URL (respects Vite base path) */
export const HISTORICAL_CSV_URL = `${import.meta.env.BASE_URL}data/enriched_baby_monitoring_data.csv`

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const VALID_TIME_OF_DAY = new Set(['Night', 'Morning', 'Afternoon', 'Evening'])
const VALID_CRY_SEVERITY = new Set(['None', 'Mild', 'Moderate', 'Severe'])
const VALID_TEMP_CATEGORY = new Set(['Low', 'Normal', 'High'])

/** Monday-first index 0..6 from a Date (getDay: Sun=0 … Sat=6) */
function mondayFirstWeekdayIndex(date) {
  return (date.getDay() + 6) % 7
}

/** Normalize cry_status → crying incident (Yes / y / true / 1; also treat positive duration with ambiguous text cautiously) */
export function isCryingStatus(raw) {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (['yes', 'y', 'true', '1', 'cry', 'crying'].includes(v)) return true
  if (['no', 'n', 'false', '0', 'calm', ''].includes(v)) return false
  return v.includes('cry')
}

export function isWetStatus(raw) {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase()
  return ['yes', 'y', 'true', '1', 'wet'].includes(v)
}

function parseNumber(raw) {
  if (raw === undefined || raw === null || raw === '') return null
  const n = Number(String(raw).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * Parse "YYYY-MM-DD HH:mm:ss" (and variants) to Date. ISO with T is most reliable across browsers.
 * If native parse fails, fall back to manual parts (avoids some Safari/edge cases).
 */
function parseTimestamp(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null
  const s = String(raw).trim()
  // Single space → T (ISO-like local); also collapse multiple spaces
  const isoish = s.includes('T') ? s : s.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/, '$1T$2')
  let d = new Date(isoish)
  if (!Number.isNaN(d.getTime())) return d

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const [, y, mo, da, h, mi, se] = m
  d = new Date(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi), Number(se))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Read CSV field with optional UTF-8 BOM on first column name */
function getRowField(row, name) {
  if (!row || typeof row !== 'object') return undefined
  if (Object.prototype.hasOwnProperty.call(row, name) && row[name] !== undefined && row[name] !== '') {
    return row[name]
  }
  const key = Object.keys(row).find((k) => k.replace(/^\uFEFF/, '') === name)
  if (key === undefined) return undefined
  const v = row[key]
  return v === '' ? undefined : v
}

function dateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateKey(raw) {
  const s = String(raw ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

function weekdayIndexFromLabel(raw) {
  const v = String(raw ?? '')
    .trim()
    .slice(0, 3)
    .toLowerCase()
  const map = {
    mon: 0,
    tue: 1,
    wed: 2,
    thu: 3,
    fri: 4,
    sat: 5,
    sun: 6,
  }
  return Object.prototype.hasOwnProperty.call(map, v) ? map[v] : null
}

function weekdayLabelFromIndex(idx) {
  return WEEKDAY_LABELS[idx] ?? null
}

function normalizeTitleWord(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return null
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function deriveTimeOfDayFromHour(hour) {
  if (!Number.isFinite(hour)) return null
  if (hour >= 0 && hour <= 5) return 'Night'
  if (hour >= 6 && hour <= 11) return 'Morning'
  if (hour >= 12 && hour <= 17) return 'Afternoon'
  if (hour >= 18 && hour <= 23) return 'Evening'
  return null
}

function deriveCrySeverity(durationSec, crying) {
  if (!crying || durationSec <= 0) return 'None'
  if (durationSec <= 60) return 'Mild'
  if (durationSec <= 180) return 'Moderate'
  return 'Severe'
}

function deriveTempCategory(temp) {
  if (!Number.isFinite(temp)) return null
  if (temp < 20) return 'Low'
  if (temp <= 27) return 'Normal'
  return 'High'
}

/**
 * Parse one CSV row into a normalized record or null if unusable.
 */
export function normalizeCsvRow(row) {
  const start = parseTimestamp(getRowField(row, 'start_timestamp'))
  if (!start) return null

  const cryStatusRaw = getRowField(row, 'cry_status')
  const durationSec = parseNumber(getRowField(row, 'cry_duration')) ?? 0

  /**
   * Intentionally derive crying from raw event fields only:
   * - `cry_status` normalized text
   * - positive `cry_duration` fallback
   */
  const crying =
    isCryingStatus(cryStatusRaw) || (Number.isFinite(durationSec) && durationSec > 0)

  const temp = parseNumber(getRowField(row, 'temperature'))
  /**
   * Intentionally derive wet status from raw field only.
   */
  const wet = isWetStatus(getRowField(row, 'wet_status'))

  const dateFromCsv = parseDateKey(getRowField(row, 'date'))
  const dayOfWeekIdxFromCsv = weekdayIndexFromLabel(getRowField(row, 'day_of_week'))
  const dateBucket = dateFromCsv || dateKey(start)
  const weekdayIndex = dayOfWeekIdxFromCsv ?? mondayFirstWeekdayIndex(start)
  const dayOfWeek = weekdayLabelFromIndex(weekdayIndex)

  const hourOfDayRaw = parseNumber(getRowField(row, 'hour_of_day'))
  const hourOfDay = Number.isFinite(hourOfDayRaw) ? hourOfDayRaw : start.getHours()
  const timeOfDayRaw = normalizeTitleWord(getRowField(row, 'time_of_day'))
  const timeOfDay = VALID_TIME_OF_DAY.has(timeOfDayRaw)
    ? timeOfDayRaw
    : deriveTimeOfDayFromHour(hourOfDay)

  const crySeverityRaw = normalizeTitleWord(getRowField(row, 'cry_severity'))
  const crySeverity = VALID_CRY_SEVERITY.has(crySeverityRaw)
    ? crySeverityRaw
    : deriveCrySeverity(durationSec, crying)

  const tempCategoryRaw = normalizeTitleWord(getRowField(row, 'temp_category'))
  const tempCategory = VALID_TEMP_CATEGORY.has(tempCategoryRaw)
    ? tempCategoryRaw
    : deriveTempCategory(temp)

  return {
    start,
    end: parseTimestamp(getRowField(row, 'end_timestamp')),
    crying,
    durationSec: durationSec !== null && durationSec >= 0 ? durationSec : 0,
    temp,
    wet,
    dateBucket,
    weekdayIndex,
    dayOfWeek,
    hourOfDay: Number.isFinite(hourOfDay) ? hourOfDay : null,
    timeOfDay,
    crySeverity,
    tempCategory,
  }
}

/**
 * Filter mode relative to the latest event in the dataset (historical CSV has no “live now”):
 * - 7d / 30d: rows with start >= (maxStart − N days)
 * - custom: explicit [startDate, endDate] selected by user (inclusive)
 */
export function filterRowsByMode(rows, mode, rangeOptions = {}) {
  if (!rows.length) return []
  const maxMs = Math.max(...rows.map((r) => r.start.getTime()))
  if (mode === 'custom') {
    const { customStartDate, customEndDate } = rangeOptions
    if (!customStartDate || !customEndDate) return []
    const start = new Date(`${customStartDate}T00:00:00`)
    const end = new Date(`${customEndDate}T23:59:59.999`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []
    if (start.getTime() > end.getTime()) return []
    return rows.filter((r) => {
      const t = r.start.getTime()
      return t >= start.getTime() && t <= end.getTime()
    })
  }
  const days = mode === '30d' ? 30 : 7
  const cutoff = maxMs - days * 86400000
  return rows.filter((r) => r.start.getTime() >= cutoff)
}

/**
 * Secondary dimensional filters (enriched fields), applied on top of the date-range mode.
 * Each filter is optional; "all" means no constraint for that dimension.
 */
export function applyAdvancedFilters(rows, filters = {}) {
  const {
    dayOfWeek = 'all',
    timeOfDay = 'all',
    crySeverity = 'all',
    tempCategory = 'all',
  } = filters

  return rows.filter((r) => {
    if (dayOfWeek !== 'all' && r.dayOfWeek !== dayOfWeek) return false
    if (timeOfDay !== 'all' && r.timeOfDay !== timeOfDay) return false
    if (crySeverity !== 'all' && r.crySeverity !== crySeverity) return false
    if (tempCategory !== 'all' && r.tempCategory !== tempCategory) return false
    return true
  })
}

/**
 * Chart-coordination selections from Analytics interactions.
 * These are applied after range + secondary filters so all constraints combine.
 */
export function applyChartSelections(rows, selections = {}) {
  const { selectedWeekday = null, selectedDonutSegment = null } = selections
  return rows.filter((r) => {
    if (selectedWeekday && r.dayOfWeek !== selectedWeekday) return false
    if (selectedDonutSegment === 'wetCrying' && !(r.crying && r.wet)) return false
    if (selectedDonutSegment === 'otherCrying' && !(r.crying && !r.wet)) return false
    return true
  })
}

/** Previous window of equal length immediately before the current filtered range (for badges). */
function previousWindowRows(allSorted, currentFiltered) {
  if (!currentFiltered.length || !allSorted.length) return []
  const minCurr = Math.min(...currentFiltered.map((r) => r.start.getTime()))
  const maxCurr = Math.max(...currentFiltered.map((r) => r.start.getTime()))
  const span = maxCurr - minCurr || 86400000
  const prevEnd = minCurr - 1
  const prevStart = prevEnd - span
  return allSorted.filter((r) => {
    const t = r.start.getTime()
    return t >= prevStart && t <= prevEnd
  })
}

function mean(nums) {
  const a = nums.filter((n) => n !== null && Number.isFinite(n))
  if (!a.length) return null
  return a.reduce((s, n) => s + n, 0) / a.length
}

function stdSample(nums) {
  const a = nums.filter((n) => n !== null && Number.isFinite(n))
  if (a.length < 2) return 0
  const m = mean(a)
  const v = a.reduce((s, n) => s + (n - m) ** 2, 0) / (a.length - 1)
  return Math.sqrt(v)
}

/**
 * Badge: week-over-week cry *episode count* change (%).
 * Rule: currentWindowCryCount vs previousWindowCryCount (same calendar span ending where current starts).
 * If previous count is 0 and current > 0 → treat as +100% display cap; if both 0 → null (no label).
 */
function cryWeekOverWeekPct(currentRows, previousRows) {
  const c = currentRows.filter((r) => r.crying).length
  const p = previousRows.filter((r) => r.crying).length
  if (p === 0 && c === 0) return null
  if (p === 0) return 100
  return Math.round(((c - p) / p) * 1000) / 10
}

/**
 * Badge: “stability” = lower day-to-day temperature variation is better.
 * Compare std.dev of *daily mean temperature* in current vs previous window.
 * Displayed % = round(((stdPrev - stdCurr) / stdPrev) * 100) when stdPrev > 0; else 0.
 */
function tempStabilityPct(currentRows, previousRows) {
  const dailyStd = (rows) => {
    const byDay = new Map()
    for (const r of rows) {
      if (r.temp === null) continue
      const k = dateKey(r.start)
      if (!byDay.has(k)) byDay.set(k, [])
      byDay.get(k).push(r.temp)
    }
    const dailyMeans = [...byDay.values()].map((arr) => mean(arr))
    return stdSample(dailyMeans)
  }
  const a = dailyStd(currentRows)
  const b = dailyStd(previousRows)
  if (b <= 0) return a <= 0 ? null : 0
  return Math.round(((b - a) / b) * 1000) / 10
}

/**
 * Badge: “Improving” if mean cry duration (seconds) per crying episode dropped ≥5% vs previous window.
 */
function cryDurationTrend(currentRows, previousRows) {
  const avgDur = (rows) => {
    const cries = rows.filter((r) => r.crying && r.durationSec > 0)
    if (!cries.length) return null
    return mean(cries.map((r) => r.durationSec))
  }
  const c = avgDur(currentRows)
  const p = avgDur(previousRows)
  if (c === null && p === null) return 'stable'
  if (p === null || p === 0) return c === null || c === 0 ? 'stable' : 'watch'
  const change = ((c - p) / p) * 100
  if (change <= -5) return 'improving'
  if (change >= 5) return 'worse'
  return 'stable'
}

/**
 * Period-over-period comparison for the **same** dimensional + chart filters as the visible charts.
 * Current window = `filtered`; previous window = `prev` (same span as range tab, immediately before).
 * Deltas are raw differences (not %), except wet share which is **percentage points** among crying episodes.
 * When `prev` is empty or current has no rows, deltas stay null and `available` is false (no invented data).
 */
function buildPeriodComparison(filtered, prev) {
  const empty = (reason) => ({
    available: false,
    reason,
    current: null,
    previous: null,
    cryingEpisodeDiff: null,
    wetCryingPctDiff: null,
    avgTempDiffCelsius: null,
    avgCryDurationDiffMinutes: null,
    strongestFactor: null,
  })

  if (!filtered.length) return empty('empty_current_window')
  if (!prev.length) return empty('no_previous_window')

  const curCry = filtered.filter((r) => r.crying).length
  const prevCry = prev.filter((r) => r.crying).length
  const cryingEpisodeDiff = curCry - prevCry

  const donutCur = buildCryingWetDonut(filtered)
  const donutPrev = buildCryingWetDonut(prev)
  const curWetPct = curCry > 0 ? donutCur.correlationPct : null
  const prevWetPct = prevCry > 0 ? donutPrev.correlationPct : null
  const wetCryingPctDiff =
    curWetPct !== null && prevWetPct !== null ? Math.round((curWetPct - prevWetPct) * 10) / 10 : null

  const curTemp = buildAvgTemp(filtered)
  const prevTemp = buildAvgTemp(prev)
  const avgTempDiffCelsius =
    curTemp !== null && prevTemp !== null ? Math.round((curTemp - prevTemp) * 10) / 10 : null

  const curMin = buildAvgMinPerDaySummary(filtered)
  const prevMin = buildAvgMinPerDaySummary(prev)
  const avgCryDurationDiffMinutes =
    Number.isFinite(curMin) && Number.isFinite(prevMin) ? Math.round((curMin - prevMin) * 10) / 10 : null

  const current = {
    rowCount: filtered.length,
    cryingEpisodes: curCry,
    wetCryingPctAmongCries: curWetPct,
    avgTempCelsius: curTemp,
    avgCryMinutesPerDay: Number.isFinite(curMin) ? curMin : null,
  }
  const previous = {
    rowCount: prev.length,
    cryingEpisodes: prevCry,
    wetCryingPctAmongCries: prevWetPct,
    avgTempCelsius: prevTemp,
    avgCryMinutesPerDay: Number.isFinite(prevMin) ? prevMin : null,
  }

  const candidates = []
  const pushScore = (key, label, delta, score) => {
    if (!Number.isFinite(delta) || delta === 0 || !Number.isFinite(score)) return
    candidates.push({ key, label, delta, score })
  }

  const cryDenom = Math.max(1, curCry, prevCry)
  pushScore('crying_episodes', 'crying episode count', cryingEpisodeDiff, Math.abs(cryingEpisodeDiff) / cryDenom)

  if (wetCryingPctDiff !== null) {
    pushScore(
      'wet_crying_share',
      'wet-related share of crying episodes (percentage points)',
      wetCryingPctDiff,
      Math.abs(wetCryingPctDiff) / 100,
    )
  }

  if (avgTempDiffCelsius !== null) {
    pushScore('avg_temperature', 'average ambient temperature (°C)', avgTempDiffCelsius, Math.abs(avgTempDiffCelsius) / 3)
  }

  if (avgCryDurationDiffMinutes !== null) {
    const minDenom = Math.max(0.5, Math.abs(prevMin), Math.abs(curMin))
    pushScore(
      'avg_cry_minutes_per_day',
      'average crying minutes per calendar day',
      avgCryDurationDiffMinutes,
      Math.abs(avgCryDurationDiffMinutes) / minDenom,
    )
  }

  candidates.sort((a, b) => b.score - a.score)
  const top = candidates[0] ?? null
  const dir = (d) => (d > 0 ? 'increased' : 'decreased')
  const strongestFactor = top
    ? {
        dimension: top.key,
        label: top.label,
        delta: top.delta,
        narrative: `${top.label.charAt(0).toUpperCase() + top.label.slice(1)} ${dir(top.delta)} the most between the current and previous window (same filters and chart selection).`,
      }
    : null

  return {
    available: true,
    reason: null,
    current,
    previous,
    cryingEpisodeDiff,
    wetCryingPctDiff,
    avgTempDiffCelsius,
    avgCryDurationDiffMinutes,
    strongestFactor,
  }
}

/** Build Mon–Sun cry episode counts for the bar chart (formula: see file header section 1). */
function buildCryByDay(rows) {
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const r of rows) {
    if (!r.crying) continue
    counts[r.weekdayIndex ?? mondayFirstWeekdayIndex(r.start)] += 1
  }
  return WEEKDAY_LABELS.map((day, i) => ({ day, episodes: counts[i] }))
}

/** Average cry duration (minutes) per weekday among crying rows (formula: see file header section 4). */
function buildDailyAvgCryMin(rows) {
  const sumMin = [0, 0, 0, 0, 0, 0, 0]
  const cnt = [0, 0, 0, 0, 0, 0, 0]
  for (const r of rows) {
    if (!r.crying) continue
    const idx = r.weekdayIndex ?? mondayFirstWeekdayIndex(r.start)
    sumMin[idx] += r.durationSec / 60
    cnt[idx] += 1
  }
  return WEEKDAY_LABELS.map((day, i) => ({
    day,
    min: cnt[i] ? Math.round((sumMin[i] / cnt[i]) * 10) / 10 : 0,
  }))
}

/** One point per calendar day: mean temp; scatter on days with ≥1 cry (formula: see file header section 2). */
function buildTempCorrelationSeries(rows) {
  if (!rows.length) {
    return { analyticsTempSeries: [{ x: 0, temp: 0 }], cryIncidents: [] }
  }
  const byDay = new Map()
  for (const r of rows) {
    // Prefer enriched `date` bucket when present.
    const k = r.dateBucket || dateKey(r.start)
    if (!byDay.has(k)) {
      byDay.set(k, { temps: [], anyCry: false, sortKey: r.start.getTime() })
    }
    const b = byDay.get(k)
    if (r.temp !== null) b.temps.push(r.temp)
    if (r.crying) b.anyCry = true
  }
  const days = [...byDay.entries()].sort((a, b) => a[1].sortKey - b[1].sortKey)
  const analyticsTempSeries = days.map(([_, v], x) => ({
    x,
    temp: mean(v.temps) ?? 0,
  }))
  const cryIncidents = days
    .map(([_, v], x) => (v.anyCry ? { x, y: mean(v.temps) ?? 0 } : null))
    .filter(Boolean)
  return { analyticsTempSeries, cryIncidents }
}

/** Donut: among crying episodes, wet+cry vs dry+cry (formula: see file header section 3). */
function buildCryingWetDonut(rows) {
  const cries = rows.filter((r) => r.crying)
  if (!cries.length) {
    return {
      cryingWetDonut: [{ name: 'No crying episodes', value: 100, color: '#e2e8f0' }],
      correlationPct: 0,
      legendWet: 0,
      legendOther: 0,
    }
  }
  let wetCry = 0
  let dryCry = 0
  for (const r of cries) {
    if (r.wet) wetCry += 1
    else dryCry += 1
  }
  const total = wetCry + dryCry
  const correlationPct = Math.round((wetCry / total) * 100)
  /** Omit zero-value slices so Recharts Pie does not receive invalid segments. */
  const cryingWetDonut = []
  if (wetCry > 0) {
    cryingWetDonut.push({ name: 'Wet & Crying', value: wetCry, color: 'var(--sbm-accent)' })
  }
  if (dryCry > 0) {
    cryingWetDonut.push({ name: 'Other Crying', value: dryCry, color: '#facc15' })
  }
  if (!cryingWetDonut.length) {
    return {
      cryingWetDonut: [{ name: 'No crying episodes', value: 100, color: '#e2e8f0' }],
      correlationPct: 0,
      legendWet: 0,
      legendOther: 0,
    }
  }
  return {
    cryingWetDonut,
    correlationPct,
    legendWet: wetCry,
    legendOther: dryCry,
  }
}

/** Overall average ambient temp (°C) — formula see file header section 6. */
function buildAvgTemp(rows) {
  const m = mean(rows.map((r) => r.temp))
  return m === null ? null : Math.round(m * 10) / 10
}

/**
 * Headline “X min avg per day” (formula: see file header section 5).
 */
function buildAvgMinPerDaySummary(rows) {
  const days = new Set(rows.map((r) => r.dateBucket || dateKey(r.start)))
  const nDays = days.size || 1
  const cryMinTotal = rows
    .filter((r) => r.crying)
    .reduce((s, r) => s + r.durationSec / 60, 0)
  return Math.round((cryMinTotal / nDays) * 10) / 10
}

/**
 * Y-axis max for daily avg cry duration chart (headroom above max bar).
 */
function yMaxForBars(dailyAvgCryMin) {
  const m = Math.max(0, ...dailyAvgCryMin.map((d) => Number(d.min) || 0))
  const cap = Math.ceil(m / 5) * 5 + 5
  const y = Math.max(30, cap)
  return Number.isFinite(y) ? y : 30
}

function pickTopLabel(countByLabel) {
  let topLabel = null
  let topCount = 0
  for (const [label, count] of countByLabel.entries()) {
    if (count > topCount) {
      topLabel = label
      topCount = count
    }
  }
  return { topLabel, topCount }
}

/**
 * Build short, parent-friendly analytical summary from the same filtered rows used by charts.
 */
function buildInsights(rows, { cryByDay, wetAndCrying, totalEpisodes, avgMinPerDaySummary, trend }) {
  if (!rows.length) {
    return {
      hasData: false,
      lines: ['No data available for the current filter and chart selections.'],
    }
  }

  // 1) Highest crying day from Mon-Sun crying episode aggregation.
  const highestDay = cryByDay.reduce(
    (best, d) => (d.episodes > best.episodes ? d : best),
    { day: 'N/A', episodes: -1 },
  )
  const highestCryingDayLine =
    highestDay.episodes > 0
      ? `Highest crying activity occurs on ${highestDay.day}.`
      : 'No crying episodes are present in this filtered view.'

  // 2) Wet-related crying percentage among crying episodes.
  const wetPct = totalEpisodes > 0 ? Math.round((wetAndCrying / totalEpisodes) * 100) : 0
  const wetRelatedLine =
    totalEpisodes > 0
      ? `${wetPct}% of crying episodes are associated with wet status.`
      : 'Wet-related crying percentage is unavailable because no crying episodes were detected.'

  // 3) Most common period from severe crying (preferred) or all crying episodes.
  const severeRows = rows.filter((r) => r.crying && r.crySeverity === 'Severe')
  const cryingRows = rows.filter((r) => r.crying)
  const timeSource = severeRows.length ? severeRows : cryingRows
  const timeCounts = new Map()
  for (const r of timeSource) {
    if (!r.timeOfDay) continue
    timeCounts.set(r.timeOfDay, (timeCounts.get(r.timeOfDay) ?? 0) + 1)
  }
  const topTime = pickTopLabel(timeCounts)
  const commonTimeLine =
    topTime.topLabel !== null
      ? severeRows.length
        ? `Severe crying is more frequent during ${topTime.topLabel.toLowerCase()} periods.`
        : `Crying episodes are most frequent during ${topTime.topLabel.toLowerCase()} periods.`
      : 'No clear time-of-day concentration is visible in this filtered view.'

  // 4) Most common temperature category in the filtered context.
  const tempCounts = new Map()
  for (const r of rows) {
    const label = r.tempCategory ?? 'Unknown'
    tempCounts.set(label, (tempCounts.get(label) ?? 0) + 1)
  }
  const topTemp = pickTopLabel(tempCounts)
  const tempCategoryLine =
    topTemp.topLabel !== null
      ? `Most temperature readings are in the ${topTemp.topLabel.toLowerCase()} category.`
      : 'Temperature category distribution is not available.'

  // 5) Average cry duration summary plus trend badge interpretation.
  let trendPhrase = 'remains stable'
  if (trend === 'improving') trendPhrase = 'is improving compared with the prior window'
  if (trend === 'worse') trendPhrase = 'is increasing compared with the prior window'
  if (trend === 'watch') trendPhrase = 'shows newly detected activity versus the prior window'
  const avgDurationLine = `Average crying duration is ${avgMinPerDaySummary} minutes per day and ${trendPhrase}.`

  // 6) Parent-focused suggestion linked to observed wet/time patterns.
  let suggestion = 'Keep monitoring daily patterns to identify consistent calming windows.'
  if (wetPct >= 50 && topTime.topLabel) {
    suggestion = `Focus diaper checks during ${topTime.topLabel.toLowerCase()} periods, because wet-associated crying is relatively high.`
  } else if (topTime.topLabel) {
    suggestion = `Prepare soothing routines before ${topTime.topLabel.toLowerCase()} periods when crying is most common.`
  }

  return {
    hasData: true,
    lines: [
      highestCryingDayLine,
      wetRelatedLine,
      commonTimeLine,
      tempCategoryLine,
      avgDurationLine,
      suggestion,
    ],
  }
}

/**
 * Debug / validation snapshot: same objects the charts use (arrays by reference where applicable).
 * avgCryDuration = mean(durationSec) over crying rows in filter — see file header section 7.
 */
function buildValidationSnapshot({
  allRowsSorted,
  mode,
  filtered,
  cryByDay,
  analyticsTempSeries,
  cryIncidents,
  dailyAvgCryMin,
  legendWet,
  legendOther,
  avgTempCelsius,
}) {
  const cryingRows = filtered.filter((r) => r.crying)
  const avgDurSec =
    cryingRows.length > 0
      ? Math.round(mean(cryingRows.map((r) => r.durationSec)) * 100) / 100
      : null

  let minTs = null
  let maxTs = null
  if (filtered.length) {
    const times = filtered.map((r) => r.start.getTime())
    minTs = new Date(Math.min(...times))
    maxTs = new Date(Math.max(...times))
  }

  return {
    totalRowsLoaded: allRowsSorted.length,
    filteredRowCount: filtered.length,
    cryingRowCount: cryingRows.length,
    wetAndCryingCount: legendWet,
    otherCryingCount: legendOther,
    avgAmbientTempCelsius: avgTempCelsius,
    avgCryDurationSeconds: avgDurSec,
    avgCryDurationMinutes:
      avgDurSec !== null ? Math.round((avgDurSec / 60) * 100) / 100 : null,
    filterMode: mode,
    minTimestampFiltered: minTs ? minTs.toISOString() : null,
    maxTimestampFiltered: maxTs ? maxTs.toISOString() : null,
    chartCryStatusByDay: cryByDay,
    chartTempLinePoints: analyticsTempSeries,
    chartTempScatterPoints: cryIncidents,
    chartDonutCounts: { wetAndCrying: legendWet, otherCrying: legendOther },
    chartDailyAvgCryMinByWeekday: dailyAvgCryMin,
  }
}

/** Safe empty state when CSV has no usable rows */
function emptyAnalyticsBundle(mode, filters, selections) {
  const cryByDay = WEEKDAY_LABELS.map((day) => ({ day, episodes: 0 }))
  const dailyAvgCryMin = WEEKDAY_LABELS.map((day) => ({ day, min: 0 }))
  const analyticsTempSeries = [{ x: 0, temp: 0 }]
  const cryIncidents = []
  const validation = buildValidationSnapshot({
    allRowsSorted: [],
    mode,
    filtered: [],
    cryByDay,
    analyticsTempSeries,
    cryIncidents,
    dailyAvgCryMin,
    legendWet: 0,
    legendOther: 0,
    avgTempCelsius: null,
  })
  return {
    cryByDay,
    analyticsTempSeries,
    cryIncidents,
    dailyAvgCryMin,
    cryingWetDonut: [{ name: 'No data', value: 1, color: '#e2e8f0' }],
    correlationPct: 0,
    legendWetCry: 0,
    legendOtherCry: 0,
    totalEpisodes: 0,
    avgTempCelsius: null,
    avgMinPerDaySummary: 0,
    yMaxDuration: 30,
    tempYDomain: [18, 32],
    badges: { weekCryPct: null, stabilityPct: null, trend: 'stable' },
    comparison: buildPeriodComparison([], []),
    insights: {
      hasData: false,
      lines: ['No data available for the current filter and chart selections.'],
    },
    meta: { rowCount: 0, cryCount: 0, empty: true, mode, filters, selections },
    validation,
  }
}

/**
 * Main entry: from cleaned + sorted rows and filter mode → everything Analytics needs.
 */
export function buildAnalyticsFromRows(
  allRowsSorted,
  mode,
  filters = {},
  selections = {},
  rangeOptions = {},
) {
  if (!allRowsSorted?.length) {
    return emptyAnalyticsBundle(mode, filters, selections)
  }

  // First apply existing date-range tab (including explicit custom range), then extra filters.
  const rangeFiltered = filterRowsByMode(allRowsSorted, mode, rangeOptions)
  const filteredByControls = applyAdvancedFilters(rangeFiltered, filters)
  // Finally apply chart-level interactions (bar/day and donut segment).
  const filtered = applyChartSelections(filteredByControls, selections)
  const prevRange = previousWindowRows(allRowsSorted, rangeFiltered)
  const prev = applyChartSelections(applyAdvancedFilters(prevRange, filters), selections)

  const cryByDay = buildCryByDay(filtered)
  let { analyticsTempSeries, cryIncidents } = buildTempCorrelationSeries(filtered)
  if (!analyticsTempSeries.length) {
    analyticsTempSeries = [{ x: 0, temp: 0 }]
    cryIncidents = []
  }
  const dailyAvgCryMin = buildDailyAvgCryMin(filtered)
  const donut = buildCryingWetDonut(filtered)
  const totalEpisodes = filtered.filter((r) => r.crying).length
  const wetAndCrying = filtered.filter((r) => r.crying && r.wet).length
  const avgTempCelsius = buildAvgTemp(filtered)
  const rawAvgMinSummary = buildAvgMinPerDaySummary(filtered)
  const avgMinPerDaySummary = Number.isFinite(rawAvgMinSummary) ? rawAvgMinSummary : 0
  const yMaxDuration = yMaxForBars(dailyAvgCryMin)

  const cryPct = cryWeekOverWeekPct(filtered, prev)
  const stabPct = tempStabilityPct(filtered, prev)
  const trend = cryDurationTrend(filtered, prev)
  const insights = buildInsights(filtered, {
    cryByDay,
    wetAndCrying,
    totalEpisodes,
    avgMinPerDaySummary,
    trend,
  })

  const comparison = buildPeriodComparison(filtered, prev)

  /** Default domain when there are no daily points (empty filter / no temps). */
  let tempYDomain = [18, 32]
  const temps = [
    ...analyticsTempSeries.map((p) => p.temp),
    ...cryIncidents.map((p) => p.y),
  ].filter((t) => Number.isFinite(t))
  if (temps.length > 0) {
    const tempMin = Math.min(...temps, 20)
    const tempMax = Math.max(...temps, 24)
    const pad = Math.max((tempMax - tempMin) * 0.08, 0.5)
    const lo = tempMin - pad
    const hi = tempMax + pad
    tempYDomain = [
      Number.isFinite(lo) ? lo : 18,
      Number.isFinite(hi) ? hi : 32,
    ]
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[Analytics DEBUG] buildAnalyticsFromRows', {
      mode,
      filteredCount: filtered.length,
      totalEpisodes,
      seriesPoints: analyticsTempSeries.length,
      scatterPoints: cryIncidents.length,
      tempYDomain,
      sampleCryByDay: cryByDay.slice(0, 3),
      selectedFilters: filters,
      selectedChartState: selections,
      customRange: rangeOptions,
    })
    // Verification log requested for Assignment 02 integration checks.
    // eslint-disable-next-line no-console
    console.log('[Analytics ENRICHED SUMMARY]', {
      totalEnrichedRowsLoaded: allRowsSorted.length,
      filteredRowsCount: filtered.length,
      cryingRowsCount: totalEpisodes,
      wetCryingCount: wetAndCrying,
      mode,
      selectedFilters: filters,
      selectedChartState: selections,
      customRange: rangeOptions,
    })
    // eslint-disable-next-line no-console
    console.log('[Analytics RANGE]', {
      mode,
      customStartDate: rangeOptions.customStartDate ?? null,
      customEndDate: rangeOptions.customEndDate ?? null,
      filteredRowsCount: filtered.length,
    })
    // eslint-disable-next-line no-console
    console.log('[Analytics INSIGHTS]', insights.lines)
  }

  const validation = buildValidationSnapshot({
    allRowsSorted,
    mode,
    filtered,
    cryByDay,
    analyticsTempSeries,
    cryIncidents,
    dailyAvgCryMin,
    legendWet: donut.legendWet,
    legendOther: donut.legendOther,
    avgTempCelsius,
  })

  return {
    cryByDay,
    analyticsTempSeries,
    cryIncidents,
    dailyAvgCryMin,
    cryingWetDonut: donut.cryingWetDonut,
    correlationPct: Number.isFinite(donut.correlationPct) ? donut.correlationPct : 0,
    legendWetCry: donut.legendWet,
    legendOtherCry: donut.legendOther,
    totalEpisodes,
    avgTempCelsius,
    avgMinPerDaySummary,
    yMaxDuration,
    tempYDomain,
    badges: {
      /** % change cry episode count vs equal prior window; null → show em dash */
      weekCryPct: cryPct,
      /** Positive = lower temp variance vs prior window */
      stabilityPct: stabPct,
      /** 'improving' | 'stable' | 'worse' | 'watch' */
      trend,
    },
    comparison,
    insights,
    meta: {
      rowCount: filtered.length,
      cryCount: totalEpisodes,
      mode,
      filters,
      selections,
    },
    validation,
  }
}

/**
 * Fetch CSV from `public/data/…`, parse with Papa Parse, return sorted normalized rows.
 */
export async function loadHistoricalCsv(url = HISTORICAL_CSV_URL) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[Analytics DEBUG] fetch CSV', { url })
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load CSV (${res.status}): ${url}`)
  const text = await res.text()
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => String(h).trim().replace(/^\uFEFF/, ''),
  })
  if (parsed.errors?.length) {
    const msg = parsed.errors.map((e) => e.message).join('; ')
    console.warn('[analytics CSV]', msg)
  }
  const rawCount = Array.isArray(parsed.data) ? parsed.data.length : 0
  const rows = []
  for (const row of parsed.data) {
    const n = normalizeCsvRow(row)
    if (n) rows.push(n)
  }
  rows.sort((a, b) => a.start - b.start)
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[Analytics DEBUG] CSV parsed', {
      url,
      papaRowCount: rawCount,
      normalizedCount: rows.length,
    })
  }
  return rows
}
