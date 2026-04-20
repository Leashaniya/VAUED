/**
 * Smart Baby Monitor — visual analytics chat assistant (LLM + grounded fallbacks).
 *
 * INTENT MAP (viva):
 * - `context.page`: "dashboard" (live sensors) vs "analytics" (historical CSV + filters).
 * - Off-topic → short redirect to monitor scope.
 * - Page mismatch (e.g. “last week trend” on Dashboard) → explain which page answers what.
 * - Vague prompts (“explain this”) → use current page + baby + top metrics/insights.
 * - Dataset questions → numbers from `context` only; never invent readings.
 */

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return null
  return Number(value)
    .toFixed(digits)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1')
}

function describeDelta(value, { unit = '', low = 1, medium = 5 } = {}) {
  if (!Number.isFinite(value)) return 'not enough change in the data to describe precisely'
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

function stripMd(text) {
  return String(text).replace(/\*\*([^*]+)\*\*/g, '$1')
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
      .replace(
        'not enough change in the data to describe precisely',
        'not enough change for a strong comparison',
      )
  }
  return text
}

function withFollowUp(answer, hints = [], style = {}) {
  if (style.short) return stripMd(applyStyle(answer, style))
  if (!hints.length) return stripMd(applyStyle(answer, style))
  return stripMd(applyStyle(`${answer}\n\nYou can also ask: ${hints.slice(0, 2).join(' or ')}.`, style))
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

/** Delta text, or explicit “not comparable” when the prior window cannot support that metric. */
function describeDeltaOrNA(value, opts) {
  if (!Number.isFinite(value)) return 'not comparable here (no prior slice or zero crying episodes)'
  return describeDelta(value, opts)
}

function comparisonUnavailableBlurb(comparison) {
  if (!comparison) return 'Comparison data is missing from this analytics bundle.'
  if (comparison.available) return ''
  if (comparison.reason === 'no_previous_window') {
    return 'There is no usable previous window of the same length before your current range (or filters remove all rows there), so period deltas are not computed — I won’t invent numbers.'
  }
  if (comparison.reason === 'empty_current_window') {
    return 'The current filtered slice has no rows, so there is nothing to compare to the previous window.'
  }
  return 'Comparison data is insufficient in this view.'
}

/** Multi-line, numbers-only summary for “what changed vs previous period?” (built from `buildPeriodComparison` in processAnalyticsData). */
function formatAnalyticsComparisonAnswer(comparison, rangeMode) {
  if (!comparison?.available) {
    return comparisonUnavailableBlurb(comparison)
  }
  const c = comparison.current
  const p = comparison.previous
  const parts = [
    `Compared with the previous equivalent **${rangeMode}** window (same advanced filters and chart selection):`,
    `• Crying episodes: **${c.cryingEpisodes}** now vs **${p.cryingEpisodes}** before — ${describeDeltaOrNA(comparison.cryingEpisodeDiff, { low: 1, medium: 4 })}.`,
    `• Wet share among cries: **${c.wetCryingPctAmongCries ?? '—'}%** vs **${p.wetCryingPctAmongCries ?? '—'}%** — ${describeDeltaOrNA(comparison.wetCryingPctDiff, { unit: ' pts', low: 1.5, medium: 6 })}.`,
    `• Avg temperature: **${c.avgTempCelsius ?? '—'}**°C vs **${p.avgTempCelsius ?? '—'}**°C — ${describeDeltaOrNA(comparison.avgTempDiffCelsius, { unit: '°C', low: 0.5, medium: 1.5 })}.`,
    `• Avg cry minutes / calendar day (headline): **${c.avgCryMinutesPerDay ?? '—'}** vs **${p.avgCryMinutesPerDay ?? '—'}** — ${describeDeltaOrNA(comparison.avgCryDurationDiffMinutes, { unit: ' min', low: 0.3, medium: 1.2 })}.`,
  ]
  if (comparison.strongestFactor) {
    parts.push(comparison.strongestFactor.narrative)
  }
  return parts.join('\n')
}

function normalizeQ(message) {
  return String(message || '')
    .trim()
    .toLowerCase()
}

const OFF_TOPIC_REGEX =
  /\b(joke|jokes|riddle|capital of|france|spain|italy|weather in|nba|football score|movie recommendation|chatgpt|sing a song|poem about|recipe for)\b/i

function isOffTopic(q) {
  if (!q) return false
  return OFF_TOPIC_REGEX.test(q)
}

function redirectOffTopic(style) {
  const msg =
    "I'm your Smart Baby Monitor assistant for this app — I help with live readings, alerts, the active baby profile, and historical analytics charts. Try asking about crying, wetness, temperature, danger status, trends, filters, or what a badge means. I’m not a general chatbot and I can’t give medical advice."
  return stripMd(applyStyle(msg, style))
}

function extractNameFromGreeting(q) {
  const m = q.match(/\b(?:i am|i'm)\s+([a-z][a-z '-]{1,30})/i)
  if (!m) return null
  const raw = m[1].trim().replace(/\s+/g, ' ')
  if (!raw) return null
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function isGreeting(q) {
  return /^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q)
}

function isSmallTalk(q) {
  return (
    q.includes('who are you') ||
    q.includes('are you fun') ||
    q.includes('can you chat') ||
    q.includes('are you real') ||
    q.includes('how are you')
  )
}

function isAmbiguousPrompt(q) {
  return (
    /^(what about( this| that| your [a-z]+)?|and this|explain\??|is that okay\??|okay\??)$/.test(q) ||
    (q.length <= 18 && /^(this|that|what|huh|hmm)\??$/.test(q))
  )
}

function pageScopeHint(context) {
  return context?.page === 'dashboard'
    ? 'I can explain live cry/wet/temp/danger status and alerts on Dashboard.'
    : 'I can explain historical trends, filters, badges, and comparisons on Analytics.'
}

function greetingReply(q, context, style) {
  const name = extractNameFromGreeting(q)
  const hello = name ? `Hi ${name}!` : 'Hi!'
  const msg = `${hello} I’m your Smart Baby Monitor assistant. I can help with live data, alerts, active baby profiles, and analytics insights. ${pageScopeHint(context)}`
  return stripMd(applyStyle(msg, style))
}

function smallTalkReply(context, style) {
  const msg = `I keep things calm and focused for this app. I can help you read Smart Baby Monitor data, alerts, baby profiles, and analytics — ${context?.page === 'dashboard' ? 'including what to check right now.' : 'including what changed in the current filtered view.'}`
  return stripMd(applyStyle(msg, style))
}

function ambiguousPromptReply(context, style) {
  if (context?.page === 'dashboard') {
    const cards = context?.cards || {}
    const cry = cards?.cry?.value ?? '—'
    const wet = cards?.wet?.value ?? '—'
    const temp = cards?.temp?.value ?? '—'
    return withFollowUp(
      `If you mean this live screen: Cry ${cry}, Wet ${wet}, Temp ${temp}. I can explain any one card in detail.`,
      ['why is danger showing attention', 'summarize the current live situation'],
      style,
    )
  }
  return withFollowUp(
    'If you mean the current analytics view, tell me which part: day chart, wetness donut, comparison badges, or key insights.',
    ['what changed compared to previous period', 'which day has the highest crying'],
    style,
  )
}

function pickVariant(q, options) {
  if (!options.length) return ''
  let sum = 0
  for (let i = 0; i < q.length; i += 1) sum += q.charCodeAt(i)
  return options[sum % options.length]
}

function wantsLiveSensorQuestion(q) {
  return (
    q.includes('right now') ||
    q.includes('currently') ||
    q.includes('cry now') ||
    q.includes('crying now') ||
    q.includes('wet now') ||
    q.includes('diaper now') ||
    q.includes('live feed') ||
    q.includes('sensor now') ||
    (q.includes('temperature') && q.includes('safe') && !q.includes('average')) ||
    (q.includes('alert') && !q.includes('historical'))
  )
}

function wantsHistoricalTrendQuestion(q) {
  return (
    q.includes('last week') ||
    q.includes('last 7') ||
    q.includes('last 30') ||
    q.includes('previous period') ||
    q.includes('csv') ||
    q.includes('historical') ||
    q.includes('trend over') ||
    q.includes('which day has') ||
    q.includes('compared to last') ||
    q.includes('vs prior')
  )
}

function explainLiveVsAnalytics(style) {
  return applyStyle(
    'You’re on **Historical Analytics** — answers here come from the filtered CSV trends (not the live crib feed). For “right now” crying, wetness, temperature, and alerts, open **Dashboard Overview**.',
    style,
  )
}

function explainAnalyticsVsLive(style) {
  return applyStyle(
    'You’re on **Dashboard Overview** — this page shows the **current live** snapshot (sound, wetness, temp, danger) and refreshes on a timer. Week-over-week charts and CSV filters live under **Analytics**.',
    style,
  )
}

function babyClause(activeBaby) {
  const n = activeBaby?.name
  if (!n) return 'No baby name is set in the active profile yet.'
  const bits = [n]
  if (activeBaby.genderLabel) bits.push(activeBaby.genderLabel.toLowerCase())
  if (activeBaby.twinLabel) bits.push(activeBaby.twinLabel)
  if (activeBaby.ageLabel) bits.push(`about ${activeBaby.ageLabel}`)
  return `The active profile is **${bits.join(', ')}**.`
}

function localDashboardReply(q, context, style) {
  const { cards, notifications, activeBaby, chartsSummary, liveGuidance, loadError, loading, liveThresholdsNarration } =
    context

  if (loadError) {
    return withFollowUp(
      `Live data is temporarily unavailable (${String(loadError).slice(0, 120)}). The cards may show placeholders until the feed recovers.`,
      ['what does cry status mean', 'how do thresholds work'],
      style,
    )
  }
  if (loading && !cards?.cry?.value) {
    return withFollowUp(
      'Live readings are still loading — give the page a moment, then ask again about cry, wet, or temperature.',
      ['what should parents monitor now', 'what does danger status mean'],
      style,
    )
  }

  if (wantsHistoricalTrendQuestion(q) && !q.includes('difference between')) {
    return withFollowUp(explainAnalyticsVsLive(style), ['open Analytics for last 7 days', 'what does the live donut mean'], style)
  }

  if (
    q.includes('which baby') ||
    q.includes('active baby') ||
    q.includes('who is this') ||
    q.includes('girl profile') ||
    q.includes('boy profile') ||
    q.includes('twin') ||
    q.includes('how old')
  ) {
    const genderAns =
      activeBaby?.gender === 'girl'
        ? 'Yes — the active profile is marked as a girl.'
        : activeBaby?.gender === 'boy'
          ? 'The active profile is marked as a boy.'
          : 'Gender is not set on the active profile in this view.'
    const twin = activeBaby?.twinLabel
      ? `Twin label on the profile: **${activeBaby.twinLabel}** (for your own naming — the app does not auto-detect twins).`
      : 'No twin label is set on this profile.'
    return withFollowUp(`${babyClause(activeBaby)} ${genderAns} ${twin}`, ['is the baby crying now', 'any active alerts'], style)
  }

  if (q.includes('what can you help') || q.includes('help me with') || q.includes('what do you do')) {
    return withFollowUp(
      'I explain **this live page**: the four status cards, the sound and temperature charts, today’s wet/dry donut, and the average cry-duration estimate. I can also read active alerts and suggest what to glance at first — calmly and without medical diagnosis.',
      ['summarize the current live situation', 'why is danger showing attention'],
      style,
    )
  }

  if (q.includes('alert') || q.includes('notification')) {
    const n = notifications?.length ?? 0
    if (!n) {
      return withFollowUp(
        `No active alert cards right now for ${activeBaby?.name || 'this profile'} — the live strip would list cry, wet, temperature, or combined “attention” cues when thresholds fire.`,
        ['is the baby crying now', 'what does danger status mean'],
        style,
      )
    }
    const titles = notifications.map((a) => a.title).join('; ')
    return withFollowUp(
      `There are **${n}** live alert(s): ${titles}. These mirror the same rules as the stat cards (sound, wetness, temperature bands, and combined “attention”).`,
      ['why is danger showing attention', 'is the temperature safe'],
      style,
    )
  }

  if (q.includes('summarize') || q.includes('summary') || q.includes('overall') || q.includes('situation')) {
    const cry = cards?.cry?.value ?? '—'
    const wet = cards?.wet?.value ?? '—'
    const temp = cards?.temp?.value ?? '—'
    const danger = cards?.danger?.value ?? '—'
    const g = liveGuidance ? ` Guidance strip: ${liveGuidance}` : ''
    return withFollowUp(
      `${babyClause(activeBaby)} Live snapshot: **Cry ${cry}**, **Wet ${wet}**, **Temp ${temp}**, **Danger ${danger}**.${g}`,
      ['what should parents monitor now', 'how do thresholds work'],
      style,
    )
  }

  if (q.includes('cry status') || (q.includes('why') && q.includes('calm'))) {
    return withFollowUp(
      `Cry status is **${cards?.cry?.value ?? '—'}** — it uses the latest sound reading with on/off thresholds (on ≥ ${context.liveThresholds?.soundCryOn ?? 430}, with hysteresis vs the last hour). ${cards?.cry?.footer || ''}`,
      ['is the baby crying now', 'what does loud mean on the chart'],
      style,
    )
  }

  if (q.includes('wet status') || (q.includes('wet') && (q.includes('why') || q.includes('diaper')))) {
    return withFollowUp(
      `Wet status is **${cards?.wet?.value ?? '—'}** — wetness at or above **${context.liveThresholds?.wetnessWet ?? 480}** reads as wet for the card. ${cards?.wet?.footer || ''} The donut shows today’s wet vs dry sample mix in the 24h stream.`,
      ['is the bed wet right now', 'what does the donut mean'],
      style,
    )
  }

  if (q.includes('donut') || (q.includes('wet') && q.includes('%'))) {
    const pct = chartsSummary?.diaperWetPct ?? 0
    return withFollowUp(
      `Today’s donut is **${pct}% wet** (${chartsSummary?.diaperWetCount ?? 0} wet vs ${chartsSummary?.diaperDryCount ?? 0} dry samples today). It’s a simple count from today’s points — not a medical score.`,
      ['is wetness more important than temperature right now', 'summarize the current live situation'],
      style,
    )
  }

  if (q.includes('temperature') && (q.includes('safe') || q.includes('comfort'))) {
    const t = cards?.temp?.value
    const band = context.liveThresholds
      ? `${context.liveThresholds.tempSafeMinC}–${context.liveThresholds.tempSafeMaxC}°C`
      : '20–30°C'
    return withFollowUp(
      `Room temperature shows **${t}** on the card. This demo treats **${band}** as the comfort band for the “outside range” alert — worth a glance at HVAC or clothing, not a diagnosis.`,
      ['why is danger showing attention', 'any active alerts'],
      style,
    )
  }

  if (q.includes('danger') || q.includes('attention') || q.includes('secure')) {
    return withFollowUp(
      `Danger status is **${cards?.danger?.value ?? '—'}**. “Attention” means multiple live cues stacked (for example very loud sound, wet, and/or temperature stress) — it’s a **nudge to check the nursery**, not an emergency diagnosis. ${cards?.danger?.footer || ''}`,
      ['what should parents monitor now', 'how do thresholds work'],
      style,
    )
  }

  if (q.includes('crying now') || q.includes('baby cry')) {
    const v = cards?.cry?.value
    const on = v === 'Crying'
    return withFollowUp(
      on
        ? `The live card reads **Crying** — sound is above the crying-on threshold. ${cards?.cry?.footer || ''}`
        : `The live card reads **Calm** for crying right now. ${cards?.cry?.footer || ''}`,
      ['any active alerts', 'what does loud mean on the chart'],
      style,
    )
  }

  if (q.includes('threshold') || (q.includes('how is') && q.includes('derived'))) {
    return withFollowUp(liveThresholdsNarration || 'Thresholds are documented in the live dashboard service for this demo.', ['why is danger showing attention', 'what does the donut mean'], style)
  }

  if (q.includes('average cry') || q.includes('cry duration')) {
    const m = chartsSummary?.avgCryDurationMinutes ?? 0
    return withFollowUp(
      `The live **average cry duration** card shows about **${m} minutes** — estimated from the last hour of sound buckets where readings stay above the cry-on threshold (grouped into short episodes, then averaged). It’s a **demo heuristic**, not clinical timing.`,
      ['what does loud mean on the chart', 'summarize the current live situation'],
      style,
    )
  }

  if (q.includes('monitor') || q.includes('attention first') || q.includes('practical')) {
    const order = []
    if (cards?.danger?.value === 'Attention') order.push('Danger / Attention — glance at the nursery first.')
    if (cards?.cry?.value === 'Crying') order.push('Sound is elevated — soothing or checking the room may help.')
    if (cards?.wet?.value === 'Wet') order.push('Wetness is up — a diaper check is a practical next step.')
    if (cards?.temp?.value && String(cards.temp.value).includes('°')) {
      const out =
        context.liveThresholds &&
        Number.isFinite(chartsSummary?.lastTemperatureCelsius) &&
        (chartsSummary.lastTemperatureCelsius < context.liveThresholds.tempSafeMinC ||
          chartsSummary.lastTemperatureCelsius > context.liveThresholds.tempSafeMaxC)
      if (out) order.push('Temperature is outside the comfort band — room comfort is worth checking.')
    }
    if (!order.length) {
      order.push('Everything looks calm on the cards — a light check-in rhythm is enough unless alerts appear.')
    }
    return withFollowUp(order.join(' '), ['any active alerts', 'open Analytics for trends'], style)
  }

  if (q.includes('chart') || q.includes('sound bar')) {
    return withFollowUp(
      'The **Hourly Sound Intensity** chart shows recent sound levels; bars at or above the cry-on threshold are highlighted. **Temp & Crying** plots room temperature over the same live window — it helps you see comfort alongside activity.',
      ['what does loud mean on the chart', 'is the temperature safe'],
      style,
    )
  }

  if (q.includes('compare') && (q.includes('live') || q.includes('historical') || q.includes('analytics'))) {
    return withFollowUp(
      '**Dashboard** = right-now cards + short charts. **Analytics** = historical CSV with filters (7d / 30d / custom) and comparison badges. Use Dashboard for “now”, Analytics for “over time”.',
      ['open Analytics for last 7 days', 'summarize the current live situation'],
      style,
    )
  }

  if (q.includes('baby a') && q.includes('baby b')) {
    return withFollowUp(
      'I only receive **the active baby’s name** for the live feed in this build — I can’t compare two children numerically unless you switch the active profile and look again, or use Analytics if each child has separate historical data.',
      ['which baby is active now', 'summarize the current live situation'],
      style,
    )
  }

  const cry = cards?.cry?.value ?? '—'
  const wet = cards?.wet?.value ?? '—'
  const temp = cards?.temp?.value ?? '—'
  const danger = cards?.danger?.value ?? '—'
  const variants = [
    `${babyClause(activeBaby)} Live snapshot: **Cry ${cry}**, **Wet ${wet}**, **Temp ${temp}**, **Danger ${danger}**.`,
    `Current live state for ${activeBaby?.name || 'this profile'}: cry is **${cry}**, wet status **${wet}**, temperature **${temp}**, and danger **${danger}**.`,
    `From this Dashboard view now: **Cry ${cry}**, **Wet ${wet}**, **Temp ${temp}**, **Danger ${danger}**. I can break down any one card if you want.`,
  ]
  return withFollowUp(
    pickVariant(q, variants),
    ['what does danger status mean', 'open Analytics for historical trends'],
    style,
  )
}

function localAnalyticsReply(q, context, style) {
  const { metrics, insights, comparison, activeFilters, chartSelections, rangeMode, badges, chartHighlights, activeBaby, filteredRowCount } =
    context

  const wetLevel = classifyWetLevel(metrics.wetCryingPercentage)
  const dominantTime = dominantTimeLine(insights, false)
  const dominantSevereTime = dominantTimeLine(insights, true)
  const tempDiff = comparison?.available ? comparison.avgTempDiffCelsius : null

  if (wantsLiveSensorQuestion(q)) {
    return withFollowUp(explainLiveVsAnalytics(style), ['which day has the highest crying', 'what changed compared to previous period'], style)
  }

  if (
    q.includes('which baby') ||
    q.includes('active baby') ||
    q.includes('girl profile') ||
    q.includes('boy profile') ||
    q.includes('twin') ||
    q.includes('how old')
  ) {
    const g = activeBaby?.genderLabel || 'not specified'
    const twin = activeBaby?.twinLabel ? ` Twin label: ${activeBaby.twinLabel}.` : ''
    const age = activeBaby?.ageLabel ? ` Age shown: ${activeBaby.ageLabel}.` : ''
    return withFollowUp(
      `${babyClause(activeBaby)} On Analytics, charts still reflect **your filters**, not multiple babies unless your CSV is split per child.${twin}${age} Profile gender: **${g}**.`,
      ['which day has the highest crying', 'summarize the current analytics view'],
      style,
    )
  }

  if (q.includes('what can you help') || q.includes('help me with')) {
    return withFollowUp(
      'I read **your current Analytics filters** and the computed summaries: crying by weekday, wet vs other crying, temperature line with cry markers, daily cry minutes, comparison badges, and Key Insights. Ask about trends, badges, wetness vs crying, or what changed vs the prior window.',
      ['summarize the current analytics view', 'what does the stability badge mean'],
      style,
    )
  }

  if (q.includes('stability')) {
    const p = badges?.stabilityPctVsPrior
    const pTxt = Number.isFinite(p) ? `${p > 0 ? '+' : ''}${p}%` : 'not available in this slice'
    return withFollowUp(
      `The **stability** badge shows **${pTxt} vs the prior window** — in this app it tracks how ambient temperature variability shifted (higher % here means calmer temperature swings vs the comparison period). It’s an **observation from the chart data**, not medical stability.`,
      ['what changed compared to previous period', 'is wetness associated with crying'],
      style,
    )
  }

  if (q.includes('vs prior') || (q.includes('week') && q.includes('%') && q.includes('cry'))) {
    const p = badges?.weekCryPctVsPrior
    const pTxt = Number.isFinite(p) ? `${p > 0 ? '+' : ''}${p}%` : 'not available'
    return withFollowUp(
      `The red **week comparison** text is **${pTxt} vs the prior week** (or matching window for 30d/custom) for **crying episode counts** in the filtered data. **0%** would mean about the same episode count as the previous period.`,
      ['what changed compared to previous period', 'which day has the highest crying'],
      style,
    )
  }

  if (q.includes('highest crying') || q.includes('which day')) {
    const peak = chartHighlights?.peakCryDay
    const line = insights.find((l) => l.toLowerCase().includes('highest crying activity'))
    const base =
      line ||
      (peak
        ? `**${peak.day}** shows the most episodes in this view (**${peak.episodes}**).`
        : 'No single day clearly dominates crying activity in the current filtered view.')
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
      `${metrics.wetCryingPercentage}% of crying episodes in this view are tagged as wet-related in the dataset.`,
      ['is wet-related crying high or low', 'how this compares with previous period'],
      style,
    )
  }

  if (q.includes('wet-related crying') && (q.includes('high') || q.includes('low'))) {
    return withFollowUp(
      `Wet-related crying looks **${wetLevel}** here (${metrics.wetCryingPercentage}%). That may suggest **checking diaper timing** when crying clusters — an observation from the chart slice, not proof of cause.`,
      ['what should parents focus on first', 'which time of day has the most crying'],
      style,
    )
  }

  if (q.includes('average temperature') || (q.includes('temperature') && q.includes('current view'))) {
    const t = Number.isFinite(metrics.averageTemperatureCelsius)
      ? `${metrics.averageTemperatureCelsius}°C`
      : 'not available for this filter set'
    return withFollowUp(
      `Average ambient temperature in the **current filtered Analytics view** is **${t}** (from the historical points behind the temp chart).`,
      ['what changed compared to previous period', 'is temperature a likely concern here'],
      style,
    )
  }

  if (q.includes('filter') || q.includes('selection') || q.includes('context')) {
    return withFollowUp(
      `Filters now: **range ${rangeMode}**, day **${activeFilters.dayOfWeek}**, time **${activeFilters.timeOfDay}**, severity **${activeFilters.crySeverity}**, temperature category **${activeFilters.tempCategory}**. Chart taps: weekday **${chartSelections.weekday}**, donut **${chartSelections.donutSegment}**. Rows in view: **${filteredRowCount ?? '—'}**.`,
      ['summarize the current analytics view', 'what changed compared to previous period'],
      style,
    )
  }

  if (q.includes('summarize') || q.includes('summary') || (q.includes('page') && !q.includes('live'))) {
    const avgTemp = Number.isFinite(metrics.averageTemperatureCelsius)
      ? `${metrics.averageTemperatureCelsius}°C`
      : 'not available'
    const peak = chartHighlights?.peakCryDay
    const peakTxt = peak ? `Peak weekday by episodes: **${peak.day}** (${peak.episodes}). ` : ''
    const cmpLine =
      comparison?.available && comparison.strongestFactor
        ? ` Vs prior window: ${comparison.strongestFactor.narrative}`
        : !comparison?.available
          ? ` ${comparisonUnavailableBlurb(comparison)}`
          : ''
    const message = `**Analytics summary** (${rangeMode}, ${filteredRowCount ?? '—'} rows): ${metrics.totalEpisodes} crying episodes, **${metrics.wetCryingPercentage}%** wet-related, avg temp **${avgTemp}**, avg cry **${metrics.averageCryMinutesPerDay} min/day**. ${peakTxt}${dominantTime || ''}${cmpLine}`
    return withFollowUp(message, ['what should parents focus on first', 'which day has the highest crying'], style)
  }

  if (
    q.includes('strongest') ||
    q.includes('which factor') ||
    (q.includes('changed the most') && (q.includes('factor') || q.includes('metric')))
  ) {
    if (!comparison?.available) {
      return withFollowUp(
        comparisonUnavailableBlurb(comparison),
        ['widen the date range', 'reset chart selections'],
        style,
      )
    }
    if (!comparison.strongestFactor) {
      return withFollowUp(
        'Across crying episodes, wet share, temperature, and cry minutes/day, no single metric moved enough between windows to stand out in this filtered slice.',
        ['what changed compared to previous period', 'summarize the current analytics view'],
        style,
      )
    }
    const sf = comparison.strongestFactor
    const c = comparison.current
    const p = comparison.previous
    return withFollowUp(
      `${sf.narrative} Snapshot: **${c.cryingEpisodes}** vs **${p.cryingEpisodes}** cries, wet share **${c.wetCryingPctAmongCries ?? '—'}%** vs **${p.wetCryingPctAmongCries ?? '—'}%**, temp **${c.avgTempCelsius ?? '—'}** vs **${p.avgTempCelsius ?? '—'}** °C, cry min/day **${c.avgCryMinutesPerDay ?? '—'}** vs **${p.avgCryMinutesPerDay ?? '—'}**.`,
      ['what changed compared to previous period', 'is wetness associated with crying'],
      style,
    )
  }

  if (
    (q.includes('wet') || q.includes('wetness')) &&
    (q.includes('than before') || q.includes('previous period') || q.includes('now than') || q.includes('more associated'))
  ) {
    if (!comparison?.available) {
      return withFollowUp(
        comparisonUnavailableBlurb(comparison),
        ['what changed compared to previous period', 'summarize the current analytics view'],
        style,
      )
    }
    const d = comparison.wetCryingPctDiff
    if (!Number.isFinite(d)) {
      return withFollowUp(
        'Wet share among cries can’t be compared period-over-period here because at least one window has **no crying episodes** after your filters.',
        ['widen filters', 'what changed compared to previous period'],
        style,
      )
    }
    const c = comparison.current?.wetCryingPctAmongCries
    const p = comparison.previous?.wetCryingPctAmongCries
    const more = d > 0 ? 'more' : d < 0 ? 'less' : 'about the same'
    return withFollowUp(
      `Among crying episodes only, wet-related share is **${c}%** now vs **${p}%** before — a change of **${d > 0 ? '+' : ''}${d} percentage points** (${more} wet-associated crying in this slice). This is descriptive from the CSV, not proof of cause.`,
      ['what changed compared to previous period', 'which factor changed the most'],
      style,
    )
  }

  if (q.includes('changed') || q.includes('compare') || q.includes('previous')) {
    const message = formatAnalyticsComparisonAnswer(comparison, rangeMode)
    return withFollowUp(message, ['compare morning vs evening', 'is temperature a likely concern here'], style)
  }

  if (q.includes('compare morning') || q.includes('morning vs evening')) {
    const message = `${dominantTime || 'A strong morning-evening split is not obvious from the current summary lines.'} If one period repeats in insights, it may be worth watching that part of the day in live monitoring too.`
    return withFollowUp(message, ['which time of day has the most severe crying', 'what should parents focus on first'], style)
  }

  if (q.includes('compare mild') || q.includes('mild vs severe')) {
    const severe = insights.find((l) => l.toLowerCase().includes('severe crying'))
    const message = severe
      ? `${severe} Severe episodes look more concentrated than mild ones in this wording.`
      : 'Severe episodes are not strongly highlighted in the current insight lines — mild/moderate crying may dominate this window.'
    return withFollowUp(message, ['what changed compared to previous period', 'what should parents monitor more closely'], style)
  }

  if (q.includes('temperature') && (q.includes('concern') || q.includes('likely'))) {
    const tempMessage = Number.isFinite(tempDiff)
      ? Math.abs(tempDiff) < 0.5
        ? 'Average temperature stayed close to the prior window.'
        : tempDiff > 0
          ? 'Average temperature **increased slightly** vs the prior window — room comfort may be worth a glance.'
          : 'Average temperature **decreased slightly** vs the prior window.'
      : 'Temperature shift vs prior window isn’t strong in this slice.'
    return withFollowUp(
      `${tempMessage} This is **correlational wording** from the chart — not causation or medical advice.`,
      ['which time of day has the most crying', 'what should parents focus on first'],
      style,
    )
  }

  if (q.includes('monitor') || q.includes('recommend') || q.includes('advice') || q.includes('focus on first')) {
    let recommendation = insights[insights.length - 1]
    if (wetLevel === 'relatively high') {
      recommendation =
        'Wet-linked crying looks relatively high here — **consider checking** diaper timing around repeated cries (dataset observation).'
    } else if (dominantSevereTime) {
      recommendation = `${dominantSevereTime} **May be worth preparing** soothing routines before that window.`
    }
    const base =
      recommendation ||
      'Practical angle: watch recurring high-cry periods in the chart and see if wet-related slices line up with the same times — then confirm with live Dashboard.'
    return withFollowUp(base, ['what changed compared to previous period', 'is wet-related crying high or low'], style)
  }

  if (q.includes('chart') || q.includes('explain this') || q.includes('what about this') || q.includes('this okay')) {
    const first = insights[0] || 'Use the weekday bars for episode counts, the temp+cry chart for context, the donut for wet vs other crying mix, and Key Insights for plain-language takeaways.'
    return withFollowUp(
      `From **your current filters**: ${first} If you meant one specific chart, tap a bar or segment first — I’ll factor that selection into the numbers next reply.`,
      ['summarize the current analytics view', 'what does the stability badge mean'],
      style,
    )
  }

  if (q.includes('are you sure') || q.includes('grounded')) {
    return withFollowUp(
      `Answers here use **only** the JSON context: range **${rangeMode}**, filters, selections (${chartSelections.weekday} / ${chartSelections.donutSegment}), and **${filteredRowCount ?? '—'}** rows — plus the precomputed insight lines.`,
      ['summarize the current analytics view', 'what changed compared to previous period'],
      style,
    )
  }

  if (q.includes('compare') && q.includes('live')) {
    return withFollowUp(explainLiveVsAnalytics(style), ['open Dashboard for live cards', 'summarize the current analytics view'], style)
  }

  const avgTemp = Number.isFinite(metrics.averageTemperatureCelsius)
    ? `${metrics.averageTemperatureCelsius}°C`
    : 'not available'
  const variants = [
    `I can help best if you point to one part: day chart, wetness donut, comparison badges, or key insights. Current filter set has ${filteredRowCount ?? '—'} rows.`,
    `Tell me what you want to inspect next — peak crying day, wetness association, temperature trend, or prior-window comparison. I’ll stay grounded to this filtered view.`,
    `I’m ready to explain this Analytics view step by step. For quick context: ${metrics.totalEpisodes} crying episodes, ${metrics.wetCryingPercentage}% wet-related, avg temp ${avgTemp}.`,
  ]
  return withFollowUp(
    pickVariant(q, variants),
    ['which day has the highest crying', 'what changed compared to previous period'],
    style,
  )
}

function localFallbackReply(message, context) {
  const q = normalizeQ(message)
  const style = styleFlags(q)

  if (isGreeting(q)) return greetingReply(q, context, style)
  if (isSmallTalk(q)) return smallTalkReply(context, style)
  if (isAmbiguousPrompt(q)) return ambiguousPromptReply(context, style)
  if (isOffTopic(q)) return redirectOffTopic(style)

  const page = context?.page === 'dashboard' ? 'dashboard' : 'analytics'

  if (page === 'dashboard') {
    if (wantsHistoricalTrendQuestion(q) && !q.includes('difference between')) {
      return withFollowUp(explainAnalyticsVsLive(style), ['open Analytics for last 7 days', 'summarize the current live situation'], style)
    }
    return localDashboardReply(q, context, style)
  }

  if (wantsLiveSensorQuestion(q)) {
    return withFollowUp(explainLiveVsAnalytics(style), ['which day has the highest crying', 'what changed compared to previous period'], style)
  }

  return localAnalyticsReply(q, context, style)
}

export async function getChatbotReply({ message, context }) {
  const q = normalizeQ(message)
  const style = styleFlags(q)
  if (isGreeting(q)) return greetingReply(q, context, style)
  if (isSmallTalk(q)) return smallTalkReply(context, style)
  if (isAmbiguousPrompt(q)) return ambiguousPromptReply(context, style)
  if (isOffTopic(q)) return redirectOffTopic(style)

  const apiBase = import.meta.env.VITE_IOT_API_BASE_URL || 'http://127.0.0.1:4000'
  try {
    const res = await fetch(`${apiBase}/api/chatbot/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context }),
    })
    if (!res.ok) throw new Error(`chatbot backend failed (${res.status})`)
    const data = await res.json().catch(() => ({}))
    const reply = stripMd(String(data?.reply || '').trim())
    if (reply) return reply
  } catch {
    // Preserve deterministic local behavior if backend/Gemini is unavailable.
  }

  return localFallbackReply(message, context)
}
