function prettyFilterValue(value, allLabel) {
  return value === 'all' ? allLabel : value
}

export function buildAnalyticsChatbotContext({
  rangeMode,
  advancedFilters,
  selections,
  analytics,
  customRange = {},
}) {
  return {
    rangeMode,
    customRange,
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
    insights: analytics.insights?.lines ?? [],
    comparison: analytics.comparison ?? {
      cryingEpisodeDiff: 0,
      wetCryingPctDiff: null,
      avgTempDiffCelsius: null,
      avgCryDurationDiffMinutes: null,
    },
  }
}

