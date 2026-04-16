function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return null
  return Number(value)
    .toFixed(digits)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1')
}

function describeDelta(value, { unit = '', low = 1, medium = 5 } = {}) {
  if (!Number.isFinite(value)) return 'insufficient change to draw a strong comparison'
  if (value === 0) return 'remained stable'
  const abs = Math.abs(value)
  const amount = formatNumber(abs, unit === ' min' ? 2 : 1)
  if (abs < low) return `showed a slight ${value > 0 ? 'increase' : 'decrease'} (${amount}${unit})`
  if (abs < medium) return `${value > 0 ? 'increased' : 'decreased'} moderately (${amount}${unit})`
  return `${value > 0 ? 'increased' : 'decreased'} noticeably (${amount}${unit})`
}

function classifyWetLevel(pct) {
  if (!Number.isFinite(pct)) return 'unclear in this view'
  if (pct >= 60) return 'relatively high'
  if (pct >= 35) return 'moderate'
  return 'relatively low'
}

function styleFlags(q) {
  return {
    simple: q.includes('simple') || q.includes('easy'),
    short: q.includes('short') || q.includes('brief'),
    tanglish: q.includes('tanglish'),
  }
}

function applyStyle(text, style) {
  if (style.tanglish) {
    return text
      .replace('Compared with', 'Compare panna')
      .replace('current view', 'current view-la')
      .replace('worth monitoring', 'monitor panna worth irukku')
      .replace('appears associated with', 'related-a theriyuthu')
      .replace('You can also ask:', 'Innum kekkalam:')
  }
  if (style.short) {
    const first = text.split('\n')[0]
    return first.length > 220 ? `${first.slice(0, 217)}...` : first
  }
  if (style.simple) {
    return text
      .replace('equivalent window', 'same-length previous period')
      .replace('associated', 'linked')
      .replace('insufficient change to draw a strong comparison', 'not enough change for a strong comparison')
  }
  return text
}

function withFollowUp(answer, hints = [], style = {}) {
  if (style.short) return applyStyle(answer, style)
  if (!hints.length) return applyStyle(answer, style)
  return applyStyle(`${answer}\n\nYou can also ask: ${hints.slice(0, 2).join(' or ')}.`, style)
}

function dominantTimeLine(insights, severePreferred = false) {
  if (severePreferred) {
    const severe = insights.find((l) => l.toLowerCase().includes('severe crying'))
    if (severe) return severe
  }
  const general = insights.find((l) => l.toLowerCase().includes('crying episodes are most frequent'))
  const severe = insights.find((l) => l.toLowerCase().includes('severe crying'))
  return general || severe || null
}

function localFallbackReply(userMessage, context) {
  const q = userMessage.toLowerCase()
  const style = styleFlags(q)
  const { metrics, insights, comparison, activeFilters, chartSelections, rangeMode } = context

  const wetLevel = classifyWetLevel(metrics.wetCryingPercentage)
  const dominantTime = dominantTimeLine(insights, false)
  const dominantSevereTime = dominantTimeLine(insights, true)
  const tempDiff = comparison?.avgTempDiffCelsius

  if (q.includes('highest crying') || q.includes('which day')) {
    const line = insights.find((l) => l.toLowerCase().includes('highest crying activity'))
    const base = line || 'No single day clearly dominates crying activity in the current filtered view.'
    return withFollowUp(base, ['which time of day has the most crying', 'what changed compared to previous period'], style)
  }

  if (q.includes('time of day') && q.includes('most') && q.includes('cry')) {
    const line = dominantTime || 'No strong time-of-day peak appears for crying in the current selection.'
    return withFollowUp(line, ['which time of day has the most severe crying', 'compare morning vs evening'], style)
  }

  if (q.includes('time of day') && q.includes('severe')) {
    const line = dominantSevereTime || 'Severe crying does not show a clear time-of-day peak in this filtered view.'
    return withFollowUp(line, ['compare mild vs severe crying', 'what should parents focus on first'], style)
  }

  if (q.includes('wet') && q.includes('percentage')) {
    return withFollowUp(
      `${metrics.wetCryingPercentage}% of crying episodes in this view are associated with wet status.`,
      ['is wet-related crying high or low', 'how this compares with previous period'],
      style,
    )
  }

  if (q.includes('wet-related crying') && (q.includes('high') || q.includes('low'))) {
    return withFollowUp(
      `Wet-related crying looks ${wetLevel} in this context (${metrics.wetCryingPercentage}%). This may suggest diaper-related discomfort appears associated with part of the crying pattern and is worth monitoring.`,
      ['what should parents focus on first', 'which time of day has the most crying'],
      style,
    )
  }

  if (q.includes('filter') || q.includes('selection') || q.includes('context')) {
    return withFollowUp(
      `Current dashboard context: range is ${rangeMode}, day filter is ${activeFilters.dayOfWeek}, time filter is ${activeFilters.timeOfDay}, severity filter is ${activeFilters.crySeverity}, and temperature filter is ${activeFilters.tempCategory}. Active chart selections are weekday ${chartSelections.weekday} and donut segment ${chartSelections.donutSegment}.`,
      ['summarize this page', 'what changed compared to previous period'],
      style,
    )
  }

  if (q.includes('summarize') || q.includes('summary') || q.includes('page')) {
    const avgTemp = Number.isFinite(metrics.averageTemperatureCelsius)
      ? `${metrics.averageTemperatureCelsius}°C`
      : 'not available'
    const message = `This page currently shows ${metrics.totalEpisodes} crying episodes, ${metrics.wetCryingPercentage}% wet-related crying, average temperature ${avgTemp}, and average cry duration ${metrics.averageCryMinutesPerDay} minutes/day. ${dominantTime || 'No dominant time-of-day spike is strongly visible.'}`
    return withFollowUp(message, ['what should parents focus on first', 'which day has the highest crying'], style)
  }

  if (q.includes('changed') || q.includes('compare') || q.includes('previous')) {
    const message = `Compared with the previous equivalent ${rangeMode} window: crying episodes ${describeDelta(comparison.cryingEpisodeDiff, { low: 1, medium: 4 })}, wet-related crying percentage ${describeDelta(comparison.wetCryingPctDiff, { unit: '%', low: 2, medium: 8 })}, average temperature ${describeDelta(comparison.avgTempDiffCelsius, { unit: '°C', low: 0.5, medium: 1.5 })}, and average cry duration ${describeDelta(comparison.avgCryDurationDiffMinutes, { unit: ' min', low: 0.3, medium: 1.2 })}.`
    return withFollowUp(message, ['compare morning vs evening', 'is temperature a likely concern here'], style)
  }

  if (q.includes('compare morning') || q.includes('morning vs evening')) {
    const message = `${dominantTime || 'A strong morning-evening split is not obvious from the current summary signals.'} If evening or night appears repeatedly, that period may suggest a higher observation priority.`
    return withFollowUp(message, ['which time of day has the most severe crying', 'what should parents focus on first'], style)
  }

  if (q.includes('compare mild') || q.includes('mild vs severe')) {
    const severe = insights.find((l) => l.toLowerCase().includes('severe crying'))
    const message = severe
      ? `${severe} This suggests severe episodes are present in identifiable periods, while mild episodes are usually more distributed.`
      : 'Severe episodes are not strongly concentrated right now, so mild and moderate crying likely dominate this filtered window.'
    return withFollowUp(message, ['what changed compared to previous period', 'what should parents monitor more closely'], style)
  }

  if (q.includes('temperature') && (q.includes('concern') || q.includes('likely'))) {
    const tempMessage = Number.isFinite(tempDiff)
      ? Math.abs(tempDiff) < 0.5
        ? 'Temperature remained fairly stable, and no major shift was detected.'
        : tempDiff > 0
          ? 'Average temperature increased slightly versus the previous window, which may suggest room comfort is worth monitoring.'
          : 'Average temperature decreased slightly versus the previous window, with no immediate strong concern signal.'
      : 'Temperature trend is not strong enough in this context to draw a firm concern signal.'
    return withFollowUp(
      `${tempMessage} This does not imply causation, but temperature appears associated with the observed pattern and is worth monitoring.`,
      ['which time of day has the most crying', 'what should parents focus on first'],
      style,
    )
  }

  if (q.includes('monitor') || q.includes('recommend') || q.includes('advice') || q.includes('focus on first')) {
    let recommendation = insights[insights.length - 1]
    if (wetLevel === 'relatively high') {
      recommendation =
        'Wet-linked crying appears relatively high. It may suggest prioritizing diaper checks during periods with repeated crying.'
    } else if (dominantSevereTime) {
      recommendation =
        `${dominantSevereTime} This may suggest preparing calming routines before that period is worth monitoring.`
    }
    const base =
      recommendation ||
      'A practical next step is to monitor recurring high-cry periods and check whether wet-associated crying clusters in the same timeframe.'
    return withFollowUp(base, ['what changed compared to previous period', 'is wet-related crying high or low'], style)
  }

  if (q.includes('are you sure') || q.includes('what about my page') || q.includes('explain this')) {
    return withFollowUp(
      `These answers are grounded in your current dashboard state: range=${rangeMode}, day=${activeFilters.dayOfWeek}, time=${activeFilters.timeOfDay}, severity=${activeFilters.crySeverity}, and chart selections (${chartSelections.weekday}, ${chartSelections.donutSegment}).`,
      ['summarize this page', 'what changed compared to previous period'],
      style,
    )
  }

  const avgTemp = Number.isFinite(metrics.averageTemperatureCelsius)
    ? `${metrics.averageTemperatureCelsius}°C`
    : 'not available'
  return withFollowUp(
    `In the current view, there are ${metrics.totalEpisodes} crying episodes, with ${metrics.wetCryingPercentage}% linked to wet status. Average ambient temperature is ${avgTemp}, and average crying duration is ${metrics.averageCryMinutesPerDay} minutes per day.`,
    ['which day has the highest crying', 'which time of day has the most severe crying'],
    style,
  )
}

export async function getChatbotReply({ message, context }) {
  const endpoint = import.meta.env.VITE_LLM_ENDPOINT
  const apiKey = import.meta.env.VITE_LLM_API_KEY
  const model = import.meta.env.VITE_LLM_MODEL || 'gpt-4o-mini'

  // If no endpoint credentials are configured, use a context-aware local fallback.
  if (!endpoint || !apiKey) {
    return localFallbackReply(message, context)
  }

  const systemPrompt =
    'You are a parent-friendly analytics assistant for a smart baby monitor dashboard. Use only the provided dashboard context. Sound natural, clear, and supportive. Provide analytical explanations in plain language, add practical non-medical guidance, avoid overclaiming causation, and vary follow-up suggestions.'

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Dashboard context:\n${JSON.stringify(context, null, 2)}` },
        { role: 'user', content: message },
      ],
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    throw new Error(`Chat service failed (${res.status})`)
  }

  const data = await res.json()
  return (
    data?.choices?.[0]?.message?.content ||
    localFallbackReply(message, context)
  )
}

