const DAY = 86_400_000

export function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISODate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Monday 00:00 local time of the week containing d. */
export function weekStart(d: Date) {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (out.getDay() + 6) % 7
  out.setDate(out.getDate() - dow)
  return out
}

/** Monday-aligned week starts covering [from, to]. */
export function weeksBetween(from: Date, to: Date) {
  const weeks: Date[] = []
  for (let w = weekStart(from); w <= to; w = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)) {
    weeks.push(w)
  }
  return weeks
}

export function weekIndex(weeks: Date[], ts: Date) {
  const ws = weekStart(ts).getTime()
  // Index by day distance rather than ms, so DST shifts don't skew it.
  return Math.round((ws - weeks[0].getTime()) / (7 * DAY))
}

const shortFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const longFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' })

export const fmtShort = (d: Date) => shortFmt.format(d)
export const fmtLong = (d: Date) => longFmt.format(d)
export const fmtMonth = (d: Date) => monthFmt.format(d)

export function fmtWeek(d: Date) {
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6)
  return `${shortFmt.format(d)} – ${shortFmt.format(end)}`
}

/** A human title for a date range: "2026", "2025 – 2026", or "Mar 2026 – Jun 2026". */
export function rangeTitle(after: string, before: string) {
  const a = fromISODate(after)
  const b = fromISODate(before)
  const fullYears = a.getMonth() === 0 && a.getDate() === 1
  if (fullYears && a.getFullYear() === b.getFullYear()) return String(a.getFullYear())
  if (fullYears && b.getMonth() === 11 && b.getDate() === 31) return `${a.getFullYear()} – ${b.getFullYear()}`
  return `${fmtMonth(a)} – ${fmtMonth(b)}`
}
