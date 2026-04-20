/**
 * Human-readable baby age for header / cards (not medical precision).
 * Uses calendar months from DOB for infants, then years.
 */
export function formatBabyAgeShort(dobInput) {
  if (!dobInput) return ''
  const birth = new Date(dobInput)
  if (Number.isNaN(birth.getTime())) return ''

  const now = new Date()
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (now.getDate() < birth.getDate()) months -= 1
  if (months < 0) return 'Newborn'

  if (months < 1) {
    const days = Math.max(0, Math.floor((now.getTime() - birth.getTime()) / 86400000))
    if (days === 0) return 'Newborn'
    if (days < 14) return `${days} day${days === 1 ? '' : 's'}`
    const weeks = Math.floor(days / 7)
    return `${weeks} wk`
  }
  if (months < 24) return `${months} mo`
  const years = Math.floor(months / 12)
  return `${years} yr`
}

/** Initials for avatar circle (first letters, max 2). */
export function babyInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
