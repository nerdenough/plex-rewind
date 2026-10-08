import type { Play } from '../api'
import { music } from '../views/configs'
import { playSeconds, rank, type Ranked } from './aggregate'
import { fmtLong, fromISODate, toISODate } from './dates'

export interface StoryData {
  year: number
  /** "2025", or "2026 so far" for year to date. */
  label: string
  dates: string
  user: string
  plays: number
  seconds: number
  artists: Ranked[]
  songs: Ranked[]
  /** Top albums, at most one per artist. */
  albums: Ranked[]
  months: { month: Date; top?: Ranked }[]
}

/**
 * The year a range covers if it's a whole calendar year or that year to date,
 * otherwise null. Story cards only make sense for those.
 */
export function storyYear(range: { after: string; before: string }) {
  const a = fromISODate(range.after)
  const b = fromISODate(range.before)
  if (a.getMonth() !== 0 || a.getDate() !== 1 || a.getFullYear() !== b.getFullYear()) return null
  const wholeYear = b.getMonth() === 11 && b.getDate() === 31
  return wholeYear || range.before === toISODate(new Date()) ? a.getFullYear() : null
}

export function buildStory(allPlays: Play[], range: { after: string; before: string }, user: string): StoryData {
  const year = fromISODate(range.after).getFullYear()
  const end = fromISODate(range.before)
  const plays = allPlays.filter((p) => playSeconds(p) >= music.minSeconds)

  const albums: Ranked[] = []
  const seen = new Set<string>()
  for (const a of rank(plays, music.album)) {
    const artist = a.key.split('|')[0]
    if (seen.has(artist)) continue
    seen.add(artist)
    albums.push(a)
    if (albums.length === 5) break
  }

  const byMonth: Play[][] = Array.from({ length: end.getMonth() + 1 }, () => [])
  for (const p of plays) {
    const d = new Date(p.date * 1000)
    if (d.getFullYear() === year && d.getMonth() < byMonth.length) byMonth[d.getMonth()].push(p)
  }

  return {
    year,
    label: end.getMonth() === 11 && end.getDate() === 31 ? String(year) : `${year} so far`,
    dates: `${fmtLong(fromISODate(range.after))} – ${fmtLong(end)}`,
    user,
    plays: plays.length,
    seconds: plays.reduce((s, p) => s + playSeconds(p), 0),
    artists: rank(plays, music.artist, music.song).slice(0, 5),
    songs: rank(plays, music.song).slice(0, 5),
    albums,
    months: byMonth.map((ps, i) => ({ month: new Date(year, i, 1), top: rank(ps, music.artist)[0] })),
  }
}
