import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'



const RAW_COLUMNS = [
  'start_timestamp',
  'end_timestamp',
  'cry_status',
  'cry_duration',
  'temperature',
  'wet_status',
]

const DERIVED_COLUMNS = [
  'date',
  'day_of_week',
  'hour_of_day',
  'time_of_day',
  'cry_severity',
  'temp_category',
]

const FINAL_COLUMNS = [...RAW_COLUMNS, ...DERIVED_COLUMNS]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parseLocalTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const normalized = value.trim().replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function safeNumber(value, fallback = null) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeBinary(value) {
  if (value == null) return null
  const text = String(value).trim().toLowerCase()
  if (!text) return null

  if (['yes', 'y', 'true', '1', 'crying', 'wet'].includes(text)) return true
  if (['no', 'n', 'false', '0', 'not crying', 'dry'].includes(text)) return false
  return null
}

function deriveTimeOfDay(hour) {
  if (hour >= 0 && hour <= 5) return 'Night'
  if (hour >= 6 && hour <= 11) return 'Morning'
  if (hour >= 12 && hour <= 17) return 'Afternoon'
  return 'Evening'
}

/**
 * Severity thresholds from cry duration (seconds):
 * - 0 sec => None (not crying)
 * - 1-60 sec => Mild
 * - 61-180 sec => Moderate
 * - >180 sec => Severe
 *
 * This creates intuitive low/medium/high buckets for charting and narratives.
 */
function deriveCrySeverity(durationSec, isCrying) {
  if (!isCrying || durationSec <= 0) return 'None'
  if (durationSec <= 60) return 'Mild'
  if (durationSec <= 180) return 'Moderate'
  return 'Severe'
}

/**
 * Temperature categories (Celsius) for room comfort analytics:
 * - < 20 => Low
 * - 20 to 27 => Normal
 * - > 27 => High
 */
function deriveTempCategory(tempC) {
  if (!Number.isFinite(tempC)) return 'Unknown'
  if (tempC < 20) return 'Low'
  if (tempC <= 27) return 'Normal'
  return 'High'
}

function csvEscape(value) {
  const str = value == null ? '' : String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function parseCsvLine(line) {
  const out = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    const next = line[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      out.push(current)
      current = ''
      continue
    }

    current += ch
  }
  out.push(current)
  return out
}

function main() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const projectRoot = path.resolve(__dirname, '..')
  const inputPath = path.join(projectRoot, 'public', 'data', 'Updated_Baby_Cry_Data_with_Wet_Status.csv')
  const outputPath = path.join(projectRoot, 'public', 'data', 'enriched_baby_monitoring_data.csv')

  const rawText = fs.readFileSync(inputPath, 'utf8')
  const lines = rawText.split(/\r?\n/).filter((line) => line.trim().length > 0)

  if (lines.length < 2) {
    throw new Error('Input CSV does not contain enough rows.')
  }

  const header = parseCsvLine(lines[0]).map((c) => c.trim().replace(/^\uFEFF/, ''))
  const headerSet = new Set(header)
  const missingColumns = RAW_COLUMNS.filter((name) => !headerSet.has(name))
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`)
  }

  const indexByName = Object.fromEntries(header.map((name, idx) => [name, idx]))
  const transformedRows = []

  const stats = {
    sourceRows: lines.length - 1,
    validRows: 0,
    skippedRows: 0,
    skippedInvalidTimestamp: 0,
    skippedInvalidDuration: 0,
    skippedInvalidTemperature: 0,
    normalizedCryFallbackCount: 0,
  }

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx += 1) {
    const parts = parseCsvLine(lines[rowIdx])
    const get = (name) => (parts[indexByName[name]] ?? '').trim()

    const startTimestamp = get('start_timestamp')
    const endTimestamp = get('end_timestamp')
    const cryStatusRaw = get('cry_status')
    const cryDurationRaw = get('cry_duration')
    const temperatureRaw = get('temperature')
    const wetStatusRaw = get('wet_status')

    const startDate = parseLocalTimestamp(startTimestamp)
    if (!startDate) {
      stats.skippedRows += 1
      stats.skippedInvalidTimestamp += 1
      continue
    }

    const cryDuration = safeNumber(cryDurationRaw, null)
    if (cryDuration == null || cryDuration < 0) {
      stats.skippedRows += 1
      stats.skippedInvalidDuration += 1
      continue
    }

    const temperature = safeNumber(temperatureRaw, null)
    if (temperature == null) {
      stats.skippedRows += 1
      stats.skippedInvalidTemperature += 1
      continue
    }

    let isCrying = normalizeBinary(cryStatusRaw)
    if (isCrying == null) {
      isCrying = cryDuration > 0
      stats.normalizedCryFallbackCount += 1
    } else if (cryDuration > 0 && !isCrying) {
      // If a row says "No" but has a positive duration, trust duration.
      isCrying = true
      stats.normalizedCryFallbackCount += 1
    }

    const hour = startDate.getHours()

    const outputRow = {
      start_timestamp: startTimestamp,
      end_timestamp: endTimestamp,
      cry_status: cryStatusRaw,
      cry_duration: cryDuration,
      temperature: temperature,
      wet_status: wetStatusRaw,
      date: startTimestamp.slice(0, 10),
      day_of_week: DAY_NAMES[startDate.getDay()],
      hour_of_day: hour,
      time_of_day: deriveTimeOfDay(hour),
      cry_severity: deriveCrySeverity(cryDuration, isCrying),
      temp_category: deriveTempCategory(temperature),
    }

    transformedRows.push(outputRow)
    stats.validRows += 1
  }

  const outputLines = [
    FINAL_COLUMNS.join(','),
    ...transformedRows.map((row) => FINAL_COLUMNS.map((col) => csvEscape(row[col])).join(',')),
  ]

  fs.writeFileSync(outputPath, outputLines.join('\n'), 'utf8')

  console.log('Dataset preprocessing completed.')
  console.log(`Input file: ${inputPath}`)
  console.log(`Output file: ${outputPath}`)
  console.log('')
  console.log(`Original columns (${RAW_COLUMNS.length}): ${RAW_COLUMNS.join(', ')}`)
  console.log(`Derived columns (${DERIVED_COLUMNS.length}): ${DERIVED_COLUMNS.join(', ')}`)
  console.log(`Final total variable count: ${FINAL_COLUMNS.length}`)
  console.log('')
  console.log(`Source rows: ${stats.sourceRows}`)
  console.log(`Valid enriched rows: ${stats.validRows}`)
  console.log(`Skipped rows: ${stats.skippedRows}`)
  console.log(`  - Invalid timestamp: ${stats.skippedInvalidTimestamp}`)
  console.log(`  - Invalid cry_duration: ${stats.skippedInvalidDuration}`)
  console.log(`  - Invalid temperature: ${stats.skippedInvalidTemperature}`)
  console.log(`Cry status fallback normalizations: ${stats.normalizedCryFallbackCount}`)
}

main()
