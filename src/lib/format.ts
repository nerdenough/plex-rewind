const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat()

export const fmtNum = (n: number) => (n >= 10_000 ? compact.format(n) : whole.format(n))
export const fmtInt = (n: number) => whole.format(n)

export function fmtDuration(seconds: number) {
  const h = seconds / 3600
  if (h >= 100) return `${fmtNum(Math.round(h))} h`
  if (h >= 1) return `${h.toFixed(1)} h`
  return `${Math.round(seconds / 60)} min`
}

export const plural = (n: number, one: string, many = `${one}s`) => `${fmtInt(n)} ${n === 1 ? one : many}`

export function initials(s: string) {
  return s
    .replace(/^the\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
