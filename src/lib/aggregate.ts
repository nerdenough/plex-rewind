import type { Play } from '../api'
import { fromISODate, toISODate, weekIndex, weeksBetween } from './dates'

export interface Item {
  key: string
  label: string
  /** Secondary line, e.g. artist for a song or show for an episode. */
  sub?: string
  /** rating_key used for artwork. */
  image?: number | string | ''
  /** The raw title as played, for tracking versions. */
  raw?: string
}

export type Extractor = (p: Play) => Item | null

export interface Ranked {
  key: string
  label: string
  sub?: string
  image?: number | string | ''
  plays: number
  seconds: number
  /** Distinct child keys (e.g. songs for an artist). */
  children: number
  /** Raw titles seen, most played first. */
  variants: { title: string; plays: number }[]
  first: number
  last: number
}

export const playSeconds = (p: Play) => p.play_duration ?? p.duration ?? 0

export function rank(plays: Play[], extract: Extractor, child?: Extractor): Ranked[] {
  const acc = new Map<
    string,
    { item: Item; plays: number; seconds: number; kids: Set<string>; raws: Map<string, number>; images: Map<string, number>; first: number; last: number }
  >()
  for (const p of plays) {
    const item = extract(p)
    if (!item) continue
    let a = acc.get(item.key)
    if (!a) {
      a = { item, plays: 0, seconds: 0, kids: new Set(), raws: new Map(), images: new Map(), first: p.date, last: p.date }
      acc.set(item.key, a)
    }
    a.plays++
    a.seconds += playSeconds(p)
    a.first = Math.min(a.first, p.date)
    a.last = Math.max(a.last, p.date)
    if (item.raw) a.raws.set(item.raw, (a.raws.get(item.raw) ?? 0) + 1)
    if (item.image) a.images.set(String(item.image), (a.images.get(String(item.image)) ?? 0) + 1)
    if (child) {
      const c = child(p)
      if (c) a.kids.add(c.key)
    }
  }
  return [...acc.values()]
    .map(({ item, plays, seconds, kids, raws, images, first, last }) => ({
      key: item.key,
      label: item.label,
      sub: item.sub,
      image: mostCommon(images) ?? item.image,
      plays,
      seconds,
      children: kids.size,
      variants: [...raws].sort((x, y) => y[1] - x[1]).map(([title, n]) => ({ title, plays: n })),
      first,
      last,
    }))
    .sort((x, y) => y.plays - x.plays || y.seconds - x.seconds || x.label.localeCompare(y.label))
}

function mostCommon(m: Map<string, number>) {
  let best: string | undefined
  let n = 0
  for (const [k, v] of m) if (v > n) [best, n] = [k, v]
  return best
}

export interface Timeline {
  weeks: Date[]
  /** Top entities across the whole range, each with a value per week. */
  series: { item: Ranked; values: number[]; children: number[] }[]
  other: number[]
  totals: number[]
  /** Full ranking within each week. */
  perWeek: Ranked[][]
}

export function timeline(
  plays: Play[],
  extract: Extractor,
  range: { after: string; before: string },
  topN: number,
  child?: Extractor,
): Timeline {
  const weeks = weeksBetween(fromISODate(range.after), fromISODate(range.before))
  const buckets: Play[][] = weeks.map(() => [])
  for (const p of plays) {
    const i = weekIndex(weeks, new Date(p.date * 1000))
    if (i >= 0 && i < weeks.length) buckets[i].push(p)
  }
  const overall = rank(plays, extract, child)
  const top = overall.slice(0, topN)
  const perWeek = buckets.map((b) => rank(b, extract, child))
  const series = top.map((item) => ({
    item,
    values: perWeek.map((w) => w.find((r) => r.key === item.key)?.plays ?? 0),
    children: perWeek.map((w) => w.find((r) => r.key === item.key)?.children ?? 0),
  }))
  const totals = perWeek.map((w) => w.reduce((s, r) => s + r.plays, 0))
  const other = totals.map((t, i) => t - series.reduce((s, x) => s + x.values[i], 0))
  return { weeks, series, other, totals, perWeek }
}

export interface Summary {
  plays: number
  seconds: number
  activeDays: number
  longestStreak: number
  busiestDay?: { date: string; plays: number }
  /** [dayOfWeek Mon=0][hour] play counts. */
  heat: number[][]
}

export function summarize(plays: Play[]): Summary {
  const days = new Map<string, number>()
  const heat = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  let seconds = 0
  for (const p of plays) {
    const d = new Date(p.date * 1000)
    const iso = toISODate(d)
    days.set(iso, (days.get(iso) ?? 0) + 1)
    heat[(d.getDay() + 6) % 7][d.getHours()]++
    seconds += playSeconds(p)
  }
  let busiestDay: Summary['busiestDay']
  for (const [date, n] of days) if (!busiestDay || n > busiestDay.plays) busiestDay = { date, plays: n }

  const sorted = [...days.keys()].sort()
  let longestStreak = 0
  let run = 0
  let prev: Date | undefined
  for (const s of sorted) {
    const d = fromISODate(s)
    const consecutive = prev && Math.round((d.getTime() - prev.getTime()) / 86_400_000) === 1
    run = consecutive ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
    prev = d
  }

  return { plays: plays.length, seconds, activeDays: days.size, longestStreak, busiestDay, heat }
}
