import { LIVE_SENSOR_THRESHOLDS } from '../services/liveDashboardService'
import { formatBabyAgeShort } from './babyAge'

function prettyFilterValue(value, allLabel) {
  return value === 'all' ? allLabel : value
}

/** Compact baby profile for chatbot grounding (active profile only). */
export function summarizeActiveBaby(baby) {
  if (!baby || typeof baby !== 'object') {
    return {
      name: null,
      gender: null,
      genderLabel: null,
      twinLabel: null,
      ageLabel: null,
    }
  }
  const gender = baby.gender === 'girl' ? 'girl' : baby.gender === 'boy' ? 'boy' : null
  return {
    id: baby.id ?? null,
    name: typeof baby.name === 'string' && baby.name.trim() ? baby.name.trim() : null,
    gender,
    genderLabel: gender === 'girl' ? 'Girl' : gender === 'boy' ? 'Boy' : null,
    twinLabel: typeof baby.twinLabel === 'string' && baby.twinLabel.trim() ? baby.twinLabel.trim() : null,
    ageLabel: formatBabyAgeShort(baby.dob) || null,
  }
}

function peakCryDayFromSeries(cryByDay) {
  if (!Array.isArray(cryByDay) || !cryByDay.length) return null
  let best = cryByDay[0]
  for (const row of cryByDay) {
    const ep = Number(row?.episodes) || 0
    if (ep > (Number(best?.episodes) || 0)) best = row
  }
  if (!best || !(Number(best.episodes) > 0)) return null
  return { day: best.day, episodes: best.episodes }
}

/**
 * Dashboard (live) context — built from the same live object the page renders.
 * Chatbot uses `page: "dashboard"` to stay on live Q&A and threshold explanations.
 */
export function buildDashboardChatbotContext({ live, activeBaby, loading, loadError }) {
  const baby = summarizeActiveBaby(activeBaby)
  const t = LIVE_SENSOR_THRESHOLDS
  const temps = live?.charts?.tempCorrelationLive ?? []
  const lastTemp = temps.length ? temps[temps.length - 1]?.temp : null

  return {
    page: 'dashboard',
    pageTitle: 'Dashboard Overview',
    dataScope: 'live_sensor_feed',
    loading: Boolean(loading),
    loadError: loadError || null,
    lastUpdatedLabel: live?.lastUpdatedLabel ?? null,
    liveGuidance: live?.liveGuidance ?? '',
    activeBaby: baby,
    cards: live?.cards ?? {},
    chartsSummary: {
      soundBarCount: live?.charts?.hourlySoundData?.length ?? 0,
      lastSoundReading:
        live?.charts?.hourlySoundData?.length > 0
          ? live.charts.hourlySoundData[live.charts.hourlySoundData.length - 1]?.value
          : null,
      diaperWetCount: live?.charts?.diaperStats?.wet ?? 0,
      diaperDryCount: live?.charts?.diaperStats?.dry ?? 0,
      diaperWetPct: live?.charts?.diaperStats?.wetPct ?? 0,
      avgCryDurationMinutes: live?.charts?.avgCryDurationMin ?? 0,
      lastTemperatureCelsius: Number.isFinite(lastTemp) ? lastTemp : null,
    },
    notifications: (live?.notifications ?? []).map((n) => ({
      title: n.title,
      detail: n.detail,
      tone: n.tone,
    })),
    /** Same numeric rules as StatCards (for viva / “why is this showing?”). */
    liveThresholds: {
      soundCryOn: t.soundCryOn,
      soundCryOff: t.soundCryOff,
      soundDanger: t.soundDanger,
      wetnessWet: t.wetnessWet,
      tempSafeMinC: t.tempSafeMinC,
      tempSafeMaxC: t.tempSafeMaxC,
      babySafeMin: t.babySafeMin,
    },
    liveThresholdsNarration: [
      `Cry status: latest sound ≥ ${t.soundCryOn} suggests crying; values between ${t.soundCryOff} and ${t.soundCryOn} can still count as crying if the hour recently peaked above ${t.soundCryOn} (short hysteresis).`,
      `“Loud” bars use sound ≥ ${t.soundDanger} (stress cue, not a medical diagnosis).`,
      `Wet status: wetness ≥ ${t.wetnessWet} reads as wet for the card; today’s donut counts wet vs dry samples from today’s 24h stream (and may align with the latest reading).`,
      `Temperature comfort band for this demo: ${t.tempSafeMinC}°C–${t.tempSafeMaxC}°C.`,
      `Danger status uses the backend final Baby Safety stream (sensor 5): values ≥ ${t.babySafeMin} show Baby Safe, otherwise Baby Unsafe.`,
      `Average cry duration (live card): estimated from the last hour of sound buckets — time above the cry-on threshold is grouped into short episodes and averaged (not a clinical measure).`,
    ].join(' '),
  }
}

/**
 * Analytics (historical CSV) context — filters, metrics, badges, and insight lines
 * the charts already computed. `page: "analytics"` keeps the assistant on historical Q&A.
 */
export function buildAnalyticsChatbotContext({
  rangeMode,
  advancedFilters,
  selections,
  analytics,
  customRange = {},
  activeBaby = null,
}) {
  const cryByDay = analytics?.cryByDay ?? []
  const peak = peakCryDayFromSeries(cryByDay)

  return {
    page: 'analytics',
    pageTitle: 'Historical Behavioral Analytics',
    dataScope: 'historical_csv_filtered',
    rangeMode,
    customRange,
    filteredRowCount: analytics?.meta?.rowCount ?? 0,
    activeBaby: summarizeActiveBaby(activeBaby),
    activeFilters: {
      dayOfWeek: prettyFilterValue(advancedFilters.dayOfWeek, 'All Days'),
      timeOfDay: prettyFilterValue(advancedFilters.timeOfDay, 'All Periods'),
      crySeverity: prettyFilterValue(advancedFilters.crySeverity, 'All Severity'),
      tempCategory: prettyFilterValue(advancedFilters.tempCategory, 'All Temperature'),
    },
    chartSelections: {
      weekday: selections.selectedWeekday || 'None',
      donutSegment:
        selections.selectedDonutSegment === 'wetCrying'
          ? 'Wet & Crying'
          : selections.selectedDonutSegment === 'otherCrying'
            ? 'Other Crying'
            : 'None',
    },
    metrics: {
      totalEpisodes: analytics.totalEpisodes ?? 0,
      wetCryingPercentage: analytics.correlationPct ?? 0,
      averageTemperatureCelsius: analytics.avgTempCelsius,
      averageCryMinutesPerDay: analytics.avgMinPerDaySummary ?? 0,
    },
    badges: {
      weekCryPctVsPrior: analytics.badges?.weekCryPct ?? null,
      stabilityPctVsPrior: analytics.badges?.stabilityPct ?? null,
      trend: analytics.badges?.trend ?? 'stable',
    },
    chartHighlights: {
      peakCryDay: peak,
      wetVsOtherLegend: {
        wetAndCryingEvents: analytics.legendWetCry ?? 0,
        otherCryingEvents: analytics.legendOtherCry ?? 0,
      },
    },
    insights: analytics.insights?.lines ?? [],
    comparison: analytics.comparison,
    analyticsNarration: [
      'Charts read from the enriched historical CSV behind this page; filters apply with AND logic.',
      'The red “vs prior week/30d” badge compares episode counts to the immediately previous window of the same length.',
      'The green stability badge reflects how average temperature moved vs the prior window (higher % = more stable in this demo’s definition).',
      'The donut “correlation %” in the center is the share of crying episodes tagged as wet-related in the current filtered slice — association, not proof of cause.',
    ].join(' '),
  }
}
