/** Hourly sound intensity — histogram bars + sparse axis ticks */
export const hourlySoundData = [
  { i: 0, tick: '12 AM', value: 12, highlight: false },
  { i: 1, tick: '', value: 18, highlight: false },
  { i: 2, tick: '', value: 22, highlight: false },
  { i: 3, tick: '4 AM', value: 15, highlight: false },
  { i: 4, tick: '', value: 28, highlight: false },
  { i: 5, tick: '', value: 45, highlight: true, loud: true },
  { i: 6, tick: '8 AM', value: 32, highlight: false },
  { i: 7, tick: '', value: 38, highlight: false },
  { i: 8, tick: '', value: 24, highlight: false },
  { i: 9, tick: '12 PM', value: 20, highlight: false },
  { i: 10, tick: '', value: 26, highlight: false },
  { i: 11, tick: '', value: 30, highlight: false },
  { i: 12, tick: '4 PM', value: 22, highlight: false },
  { i: 13, tick: '', value: 35, highlight: true },
  { i: 14, tick: '', value: 40, highlight: false },
  { i: 15, tick: '8 PM', value: 55, highlight: true, active: true },
]

export const tempCorrelationLive = [
  { t: '12 AM', temp: 71.2 },
  { t: '8 AM', temp: 72.8 },
  { t: '4 PM', temp: 71.5 },
  { t: 'CURRENT', temp: 72.4 },
]

export const diaperStats = { wet: 9, dry: 4, wetPct: 65 }

export const notifications = [
  {
    id: '1',
    title: 'Cry Detected',
    time: '2m ago',
    detail: 'High severity alert in nursery',
    tone: 'red',
    icon: 'volume',
  },
  {
    id: '2',
    title: 'Wet Bedsheet',
    time: '15m ago',
    detail: 'Hygiene sensor triggered',
    tone: 'blue',
    icon: 'droplet',
  },
  {
    id: '3',
    title: 'Edge Proximity Warning',
    time: '32m ago',
    detail: 'Safety hazard: baby near crib edge',
    tone: 'orange',
    icon: 'alert',
  },
]
