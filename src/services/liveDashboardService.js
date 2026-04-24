const API_BASE_URL = import.meta.env.VITE_IOT_API_BASE_URL || 'http://127.0.0.1:4000'
const API_KEY = import.meta.env.VITE_IOT_API_KEY || 'my_secret_api_key_123'

const SENSOR = {
  temperature: '1',
  humidity: '2',
  wetness: '3',
  sound: '4',
  babySafety: '5',
}

/**
 * Thresholds tuned for current simulator output scale.
 * Keep these explicit for viva explanation and easy calibration.
 */
/** Exported for chatbot / viva: same numbers used by live cards and charts. */
export const LIVE_SENSOR_THRESHOLDS = {
  // Simulator sound sits near ~380-405 frequently; use hysteresis-style bands.
  soundCryOn: 430,
  soundCryOff: 390,
  soundDanger: 520,
  // Wetness often hovers around 390-430; lift threshold to reduce false wet alerts.
  wetnessWet: 480,
  tempSafeMinC: 20,
  tempSafeMaxC: 30,
  babySafeMin: 0.5,
}

const THRESHOLDS = LIVE_SENSOR_THRESHOLDS

function fmtTime(dateLike) {
  const d = new Date(dateLike)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatRelativeTime(dateLike) {
  const d = new Date(dateLike)
  if (Number.isNaN(d.getTime())) return 'now'
  const deltaSec = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000))
  if (deltaSec < 60) return 'just now'
  const min = Math.round(deltaSec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  return `${hr}h ago`
}

function getSensorValue(snapshot, sensorId) {
  const row = snapshot?.sensors?.find((s) => s.sensorId === sensorId)
  return Number.isFinite(row?.reading) ? row.reading : null
}

function pointValue(point, sensorId) {
  const key = `s${sensorId}`
  const v = point?.[key]
  return Number.isFinite(v) ? v : null
}

function estimateCryDuration(chart1h) {
  const points = chart1h?.points ?? []
  const bucketMin = Number(chart1h?.bucketMs || 0) / 60000
  if (!points.length || !Number.isFinite(bucketMin) || bucketMin <= 0) return 0

  let episodes = []
  let currentEpisodeMin = 0
  let wasActive = false
  let activeThresholdCrossings = 0
  const soundSeries = []

  for (const p of points) {
    const sound = pointValue(p, SENSOR.sound)
    soundSeries.push(Number.isFinite(sound) ? Math.round(sound) : null)
    const active = Number.isFinite(sound) && sound >= THRESHOLDS.soundCryOn
    if (active && !wasActive) activeThresholdCrossings += 1
    if (active) {
      currentEpisodeMin += bucketMin
    } else if (currentEpisodeMin > 0) {
      episodes.push(currentEpisodeMin)
      currentEpisodeMin = 0
    }
    wasActive = active
  }
  if (currentEpisodeMin > 0) episodes.push(currentEpisodeMin)
  const avgMin = episodes.length
    ? Math.round((episodes.reduce((s, v) => s + v, 0) / episodes.length) * 10) / 10
    : 0

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[LIVE DASHBOARD VALIDATION] [AVG CRY DURATION]', {
      window: '1h',
      bucketMin,
      soundValues: soundSeries,
      thresholdOn: THRESHOLDS.soundCryOn,
      thresholdCrossings: activeThresholdCrossings,
      groupedEpisodeMinutes: episodes,
      averageMinutes: avgMin,
      defaultedToZero: avgMin === 0,
      clamped: false,
    })
  }

  return avgMin
}

function buildHourlySoundData(chart1h) {
  const points = chart1h?.points ?? []
  if (!points.length) {
    return [{ i: 0, tick: 'Now', value: 0, highlight: false }]
  }
  const maxBars = 16
  const step = Math.max(1, Math.ceil(points.length / maxBars))
  const sampled = points.filter((_, i) => i % step === 0).slice(-maxBars)
  const lastIndex = sampled.length - 1

  return sampled.map((p, i) => {
    const sound = pointValue(p, SENSOR.sound) ?? 0
    return {
      i,
      tick: i % 3 === 0 || i === lastIndex ? fmtTime(p.timeISO) : '',
      value: Math.round(sound),
      highlight: sound >= THRESHOLDS.soundCryOn,
      loud: sound >= THRESHOLDS.soundDanger,
      active: i === lastIndex,
    }
  })
}

function buildTempCorrelationSeries(chart1h) {
  const points = chart1h?.points ?? []
  if (!points.length) {
    return [{ t: 'Now', temp: 0 }]
  }
  const maxPoints = 12
  const step = Math.max(1, Math.ceil(points.length / maxPoints))
  const sampled = points.filter((_, i) => i % step === 0).slice(-maxPoints)

  return sampled.map((p, i, arr) => ({
    t: i === arr.length - 1 ? 'CURRENT' : fmtTime(p.timeISO),
    temp: Math.round((pointValue(p, SENSOR.temperature) ?? 0) * 10) / 10,
  }))
}

function buildDiaperStats(chart24h, latestWetness, latestWetAt) {
  const points = chart24h?.points ?? []
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayPoints = points.filter(
    (p) => typeof p?.timeISO === 'string' && p.timeISO.slice(0, 10) === todayKey,
  )
  let wet = 0
  let dry = 0
  for (const p of todayPoints) {
    const w = pointValue(p, SENSOR.wetness)
    if (!Number.isFinite(w)) continue
    if (w >= THRESHOLDS.wetnessWet) wet += 1
    else dry += 1
  }

  // Align today's donut with current card state when the latest wetness reading is from today.
  const latestIsToday =
    typeof latestWetAt === 'string' && latestWetAt.slice(0, 10) === todayKey
  const latestIsWet = Number.isFinite(latestWetness) && latestWetness >= THRESHOLDS.wetnessWet
  if (latestIsToday && latestIsWet && wet === 0) {
    wet += 1
  }

  const total = wet + dry
  const wetPct = total ? Math.round((wet / total) * 100) : 0

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[LIVE DASHBOARD VALIDATION] [DIAPER STATS]', {
      timeWindow: `today (${todayKey})`,
      total24hPoints: points.length,
      todayPoints: todayPoints.length,
      wetThreshold: THRESHOLDS.wetnessWet,
      latestWetness: Number.isFinite(latestWetness) ? Math.round(latestWetness) : null,
      latestWetAt: latestWetAt ?? null,
      latestIsToday,
      latestIsWet,
      wetCount: wet,
      dryCount: dry,
      wetPercentage: wetPct,
    })
  }

  return { wet, dry, wetPct }
}

/**
 * Generate parent-friendly live alerts from the same derived card logic as the stat cards.
 * Optional babyName ties alerts to the active profile for notifications / demo clarity.
 */
function buildLiveNotifications({
  babyName,
  cryingNow,
  wetNow,
  tempOutOfRange,
  danger,
  tempC,
  sound,
  wetness,
  latestAt,
}) {
  const time = formatRelativeTime(latestAt)
  const who = babyName ? `${babyName}: ` : ''
  const alerts = []

  if (danger) {
    alerts.push({
      id: `danger-${latestAt ?? Date.now()}`,
      title: 'Attention needed',
      time,
      detail: `${who}A safety beam has been interrupted. Please check the baby area.`,
      tone: 'orange',
      icon: 'alert',
    })
  }

  if (cryingNow) {
    alerts.push({
      id: `cry-${latestAt ?? Date.now()}`,
      title: `Cry detected${babyName ? ` for ${babyName}` : ''}`,
      time,
      detail: `${who}Sound is above the crying threshold (${Math.round(sound ?? 0)}).`,
      tone: 'red',
      icon: 'volume',
    })
  }

  if (wetNow) {
    alerts.push({
      id: `wet-${latestAt ?? Date.now()}`,
      title: 'Wetness threshold crossed',
      time,
      detail: `${who}Wetness reading ${Math.round(wetness ?? 0)} suggests a diaper or bedding check.`,
      tone: 'blue',
      icon: 'droplet',
    })
  }

  if (tempOutOfRange) {
    alerts.push({
      id: `temp-${latestAt ?? Date.now()}`,
      title: 'Temperature outside comfort band',
      time,
      detail: `${who}Room temp is ${Number.isFinite(tempC) ? tempC.toFixed(1) : '--'}°C (outside the usual safe range for this demo).`,
      tone: 'orange',
      icon: 'alert',
    })
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[LIVE DASHBOARD VALIDATION] [NOTIFICATIONS]', {
      activeAlerts: alerts.length,
      titles: alerts.map((a) => a.title),
      latestAt: latestAt ?? null,
    })
  }

  return alerts
}

/**
 * One-line parent-facing guidance from the same booleans as cards (non-medical).
 */
function buildLiveGuidance({
  babyName,
  cryingNow,
  wetNow,
  tempOutOfRange,
  danger,
  tempC,
}) {
  const label = babyName ? `${babyName}: ` : ''
  if (danger) {
    return `${label}A safety beam has been interrupted, so a quick check is recommended.`
  }
  if (wetNow) {
    return `${label}Wetness is elevated — a quick diaper check may help.`
  }
  if (tempOutOfRange) {
    return `${label}Room temperature is outside the usual comfort band.`
  }
  if (cryingNow) {
    return `${label}Sound activity is elevated — your baby may need soothing.`
  }
  if (Number.isFinite(tempC)) {
    return `${label}Both safety beams are intact.`
  }
  return `${label}Current live conditions look stable.`
}

function transformLiveSnapshot(current, chart1h, chart24h, context = {}) {
  const babyName = typeof context.babyName === 'string' ? context.babyName.trim() : ''
  const tempC = getSensorValue(current, SENSOR.temperature)
  const wetness = getSensorValue(current, SENSOR.wetness)
  const sound = getSensorValue(current, SENSOR.sound)
  const babySafety = getSensorValue(current, SENSOR.babySafety)
  const humidity = getSensorValue(current, SENSOR.humidity)

  const oneHourSounds = (chart1h?.points ?? [])
    .map((p) => pointValue(p, SENSOR.sound))
    .filter((v) => Number.isFinite(v))
  const oneHourMaxSound = oneHourSounds.length ? Math.max(...oneHourSounds) : null
  const cryingNow =
    Number.isFinite(sound) &&
    (sound >= THRESHOLDS.soundCryOn ||
      (sound >= THRESHOLDS.soundCryOff &&
        Number.isFinite(oneHourMaxSound) &&
        oneHourMaxSound >= THRESHOLDS.soundCryOn))
  const wetNow = Number.isFinite(wetness) && wetness >= THRESHOLDS.wetnessWet
  const tempOutOfRange =
    Number.isFinite(tempC) &&
    (tempC < THRESHOLDS.tempSafeMinC || tempC > THRESHOLDS.tempSafeMaxC)
  const soundDanger = Number.isFinite(sound) && sound >= THRESHOLDS.soundDanger
  const babySafe = Number.isFinite(babySafety) && babySafety >= THRESHOLDS.babySafeMin
  const danger = !babySafe

  const avgCryDurationMin = estimateCryDuration(chart1h)
  const hourlySoundData = buildHourlySoundData(chart1h)
  const tempCorrelationLive = buildTempCorrelationSeries(chart1h)
  const latestWetAt = current?.sensors?.find((s) => s?.sensorId === SENSOR.wetness)?.at ?? null
  const diaperStats = buildDiaperStats(chart24h, wetness, latestWetAt)
  const latestAt = current?.sensors?.find((s) => s?.at)?.at
  const notifications = buildLiveNotifications({
    babyName,
    cryingNow,
    wetNow,
    tempOutOfRange,
    danger,
    tempC,
    sound,
    wetness,
    latestAt,
  })

  const liveGuidance = buildLiveGuidance({
    babyName,
    cryingNow,
    wetNow,
    tempOutOfRange,
    danger,
    tempC,
  })

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[LIVE DASHBOARD VALIDATION] [CRY STATUS]', {
      latestSound: Number.isFinite(sound) ? Math.round(sound) : null,
      thresholdOn: THRESHOLDS.soundCryOn,
      thresholdOff: THRESHOLDS.soundCryOff,
      oneHourMaxSound: Number.isFinite(oneHourMaxSound) ? Math.round(oneHourMaxSound) : null,
      status: cryingNow ? 'Crying' : 'Calm',
    })
    // eslint-disable-next-line no-console
    console.log('[LIVE DASHBOARD VALIDATION] [WET STATUS]', {
      latestWetness: Number.isFinite(wetness) ? Math.round(wetness) : null,
      threshold: THRESHOLDS.wetnessWet,
      status: wetNow ? 'Wet' : 'Dry',
    })
    // eslint-disable-next-line no-console
    console.log('[LIVE DASHBOARD VALIDATION] [WET ALIGNMENT]', {
      latestWetness: Number.isFinite(wetness) ? Math.round(wetness) : null,
      wetThreshold: THRESHOLDS.wetnessWet,
      todayWetCount: diaperStats.wet,
      todayDryCount: diaperStats.dry,
      donutWetPercentage: diaperStats.wetPct,
    })
    // eslint-disable-next-line no-console
    console.log('[LIVE DASHBOARD VALIDATION] [DANGER STATUS]', {
      latestTemperatureC: Number.isFinite(tempC) ? Number(tempC.toFixed(2)) : null,
      latestWetness: Number.isFinite(wetness) ? Math.round(wetness) : null,
      latestSound: Number.isFinite(sound) ? Math.round(sound) : null,
      latestBabySafety: Number.isFinite(babySafety) ? Number(babySafety.toFixed(3)) : null,
      rules: {
        babySafe,
      },
      finalStatus: danger ? 'Baby Unsafe' : 'Baby Safe',
    })
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[LIVE DASHBOARD VALIDATION] [SOUND CHART]', {
      sourceWindow: '1h',
      rawPointCount: (chart1h?.points ?? []).length,
      renderedBucketCount: hourlySoundData.length,
      labels: hourlySoundData.map((b) => b.tick).filter(Boolean),
      values: hourlySoundData.map((b) => b.value),
    })
  }

  return {
    cards: {
      cry: {
        value: cryingNow ? 'Crying' : 'Calm',
        footer: cryingNow
          ? `Live sound ${Math.round(sound ?? 0)} suggests active crying`
          : 'No strong cry signal detected',
        footerGood: !cryingNow,
      },
      wet: {
        value: wetNow ? 'Wet' : 'Dry',
        footer: wetNow
          ? `Wetness ${Math.round(wetness ?? 0)} above threshold`
          : 'Wetness currently within dry range',
      },
      temp: {
        value: Number.isFinite(tempC) ? `${tempC.toFixed(1)}°C` : '—',
        footer:
          Number.isFinite(tempC) && Number.isFinite(humidity)
            ? `Humidity ${Math.round(humidity)}%`
            : 'Temperature stream active',
      },
      danger: {
        value: danger ? 'Baby Unsafe' : 'Baby Safe',
        footer: danger
          ? 'A safety beam has been interrupted'
          : 'Both safety beams are intact',
        footerGood: !danger,
      },
    },
    charts: {
      hourlySoundData,
      tempCorrelationLive,
      diaperStats,
      avgCryDurationMin,
    },
    notifications,
    liveGuidance,
    lastUpdatedLabel: latestAt
      ? `Last updated: ${new Date(latestAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
      : 'Last updated: --',
  }
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'X-API-Key': API_KEY,
    },
  })
  if (!res.ok) {
    throw new Error(`API ${path} failed (${res.status})`)
  }
  return res.json()
}

export async function fetchLiveDashboardData(context = {}) {
  const [current, chart1h, chart24h] = await Promise.all([
    apiGet('/api/readings/current'),
    apiGet('/api/readings/chart?range=1h'),
    apiGet('/api/readings/chart?range=24h'),
  ])

  const transformed = transformLiveSnapshot(current, chart1h, chart24h, context)

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[Dashboard LIVE] current snapshot', current)
    // eslint-disable-next-line no-console
    console.log('[Dashboard LIVE] series lengths', {
      soundBars: transformed.charts.hourlySoundData.length,
      tempPoints: transformed.charts.tempCorrelationLive.length,
      diaperWetDryTotal: transformed.charts.diaperStats.wet + transformed.charts.diaperStats.dry,
    })
  }

  return transformed
}

