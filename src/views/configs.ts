import type { Library, Play } from '../api'
import type { ArtShape } from '../components/RankCard'
import type { StatDef } from '../components/Stats'
import type { Extractor, Ranked, Summary } from '../lib/aggregate'
import { fromISODate } from '../lib/dates'
import { fmtDuration, fmtInt, fmtNum, plural } from '../lib/format'
import { artistKey, cleanTitle, titleKey } from '../lib/normalize'

type Noun = [string, string]

interface RankDef {
  title: string
  subtitle?: string
  extract: Extractor
  child?: Extractor
  childUnit?: Noun
  art: ArtShape
  showVersions?: boolean
}

interface TimelineDef {
  title: string
  subtitle: string
  extract: Extractor
  child?: Extractor
  childUnit?: Noun
  single?: boolean
  /** Leave the "everything else" remainder out of the stacked chart. */
  hideOther?: boolean
}

export interface ViewConfig {
  noun: string
  unit: Noun
  /** Plays shorter than this are treated as skips. */
  minSeconds: number
  timelines: TimelineDef[]
  ranks: RankDef[]
  stats: (s: Summary, ranks: Ranked[][]) => StatDef[]
}

// ---------- music ----------

const VARIOUS = /^(various(\s+artists)?|va|soundtrack|original soundtrack|compilation)s?$/i

function trackArtist(p: Play) {
  const album = p.grandparent_title?.trim()
  const track = p.original_title?.trim()
  if ((!album || VARIOUS.test(album)) && track) return { name: track, image: '' as const }
  return { name: album || track || 'Unknown artist', image: p.grandparent_rating_key }
}

const artist: Extractor = (p) => {
  const a = trackArtist(p)
  return { key: artistKey(a.name), label: a.name, image: a.image }
}

const song: Extractor = (p) => {
  const a = trackArtist(p)
  return {
    key: `${artistKey(a.name)}|${titleKey(p.title, a.name)}`,
    label: cleanTitle(p.title, a.name),
    sub: a.name,
    image: p.parent_rating_key,
    raw: p.title,
  }
}

const album: Extractor = (p) => {
  const a = trackArtist(p)
  return {
    key: `${artistKey(a.name)}|${titleKey(p.parent_title, a.name)}`,
    label: cleanTitle(p.parent_title, a.name),
    sub: a.name,
    image: p.parent_rating_key,
    raw: p.parent_title,
  }
}

// ---------- tv ----------

const show: Extractor = (p) => ({
  key: String(p.grandparent_rating_key || p.grandparent_title),
  label: p.grandparent_title || p.title,
  image: p.grandparent_rating_key || p.rating_key,
})

const episode: Extractor = (p) => {
  const se = p.parent_media_index !== '' && p.media_index !== '' ? `S${p.parent_media_index}·E${p.media_index}` : ''
  return {
    key: String(p.rating_key),
    label: p.title,
    sub: [p.grandparent_title, se].filter(Boolean).join(' · '),
    image: p.grandparent_rating_key || p.rating_key,
  }
}

// ---------- movies & everything else ----------

const movie: Extractor = (p) => ({
  key: String(p.rating_key || p.full_title),
  label: p.title || p.full_title,
  sub: p.year ? String(p.year) : undefined,
  image: p.rating_key,
})

const anything: Extractor = (p) => ({
  key: String(p.grandparent_rating_key || p.rating_key || p.full_title),
  label: p.grandparent_title || p.full_title || p.title,
  image: p.grandparent_rating_key || p.rating_key,
})

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

function common(s: Summary, unit: string): StatDef[] {
  return [
    {
      label: 'Daily average',
      value: s.activeDays ? (s.plays / s.activeDays).toFixed(1) : '0',
      hint: `${unit} per active day`,
    },
    { label: 'Longest streak', value: plural(s.longestStreak, 'day'), hint: `${fmtInt(s.activeDays)} active days` },
    {
      label: 'Busiest day',
      value: s.busiestDay ? dayFmt.format(fromISODate(s.busiestDay.date)) : '—',
      hint: s.busiestDay ? `${fmtInt(s.busiestDay.plays)} ${unit}` : undefined,
    },
  ]
}

const CONFIGS: Record<string, ViewConfig> = {
  artist: {
    noun: 'Music',
    unit: ['play', 'plays'],
    minSeconds: 30,
    timelines: [
      {
        title: 'Top artists, week by week',
        subtitle: 'Songs streamed per week for your most-played artists. Click a week to see its full chart.',
        extract: artist,
        child: song,
        childUnit: ['song', 'songs'],
      },
      {
        title: 'Top songs, week by week',
        subtitle: 'Live, acoustic, demo, remastered and other versions count as the same song.',
        extract: song,
        hideOther: true,
      },
    ],
    ranks: [
      { title: 'Top artists', extract: artist, child: song, childUnit: ['song', 'songs'], art: 'round' },
      { title: 'Top songs', subtitle: 'All versions of a song combined', extract: song, art: 'square', showVersions: true },
      { title: 'Top albums', extract: album, art: 'square' },
    ],
    stats: (s, [artists, songs]) => [
      {
        label: 'Minutes listened',
        value: fmtInt(Math.round(s.seconds / 60)),
        hint: `That's ${(s.seconds / 86400).toFixed(1)} days of music`,
        hero: true,
      },
      { label: 'Songs streamed', value: fmtNum(s.plays) },
      { label: 'Artists', value: fmtNum(artists.length) },
      { label: 'Different songs', value: fmtNum(songs.length) },
      ...common(s, 'plays'),
    ],
  },
  show: {
    noun: 'TV',
    unit: ['episode', 'episodes'],
    minSeconds: 0,
    timelines: [
      {
        title: 'Top shows, week by week',
        subtitle: 'Episodes watched per week for your most-watched shows. Click a week to see its full chart.',
        extract: show,
        child: episode,
        childUnit: ['episode', 'episodes'],
      },
    ],
    ranks: [
      { title: 'Top shows', extract: show, child: episode, childUnit: ['unique episode', 'unique episodes'], art: 'poster' },
      { title: 'Most-watched episodes', extract: episode, art: 'poster' },
    ],
    stats: (s, [shows, episodes]) => [
      { label: 'Hours watched', value: fmtNum(Math.round(s.seconds / 3600)), hint: `${(s.seconds / 86400).toFixed(1)} days of TV`, hero: true },
      { label: 'Episodes', value: fmtNum(s.plays) },
      { label: 'Shows', value: fmtNum(shows.length) },
      { label: 'Unique episodes', value: fmtNum(episodes.length) },
      ...common(s, 'episodes'),
    ],
  },
  movie: {
    noun: 'Movies',
    unit: ['movie', 'movies'],
    minSeconds: 0,
    timelines: [
      {
        title: 'Movies, week by week',
        subtitle: 'Movies watched each week. Click a week to see what was on.',
        extract: movie,
        single: true,
      },
    ],
    ranks: [{ title: 'Most-watched movies', extract: movie, art: 'poster' }],
    stats: (s, [movies]) => [
      { label: 'Hours watched', value: fmtNum(Math.round(s.seconds / 3600)), hint: `${(s.seconds / 86400).toFixed(1)} days of film`, hero: true },
      { label: 'Movies played', value: fmtNum(s.plays) },
      { label: 'Different movies', value: fmtNum(movies.length) },
      { label: 'Rewatches', value: fmtNum(s.plays - movies.length) },
      ...common(s, 'movies'),
    ],
  },
}

const book: Extractor = (p) => ({
  key: String(p.parent_rating_key || p.parent_title),
  label: p.parent_title || p.title,
  sub: p.grandparent_title,
  image: p.parent_rating_key,
})

const author: Extractor = (p) => ({
  key: artistKey(p.grandparent_title || p.original_title || 'Unknown'),
  label: p.grandparent_title || p.original_title || 'Unknown author',
  image: p.grandparent_rating_key,
})

const chapter: Extractor = (p) => ({ key: String(p.rating_key), label: p.title })

const AUDIOBOOKS: ViewConfig = {
  noun: 'Audiobooks',
  unit: ['chapter', 'chapters'],
  minSeconds: 60,
  timelines: [
    {
      title: 'Books, week by week',
      subtitle: 'Chapters played per week for your most-listened books. Click a week to see its full chart.',
      extract: book,
      child: chapter,
      childUnit: ['chapter', 'chapters'],
    },
  ],
  ranks: [
    { title: 'Top books', extract: book, child: chapter, childUnit: ['chapter', 'chapters'], art: 'square' },
    { title: 'Top authors', extract: author, child: book, childUnit: ['book', 'books'], art: 'round' },
  ],
  stats: (s, [books, authors]) => [
    { label: 'Hours listened', value: fmtNum(Math.round(s.seconds / 3600)), hint: `${(s.seconds / 86400).toFixed(1)} days of stories`, hero: true },
    { label: 'Chapters', value: fmtNum(s.plays) },
    { label: 'Books', value: fmtNum(books.length) },
    { label: 'Authors', value: fmtNum(authors.length) },
    ...common(s, 'chapters'),
  ],
}

const FALLBACK: ViewConfig = {
  noun: 'Library',
  unit: ['play', 'plays'],
  minSeconds: 0,
  timelines: [{ title: 'Week by week', subtitle: 'Plays per week for the most-played items.', extract: anything }],
  ranks: [{ title: 'Most played', extract: anything, art: 'square' }],
  stats: (s, [items]) => [
    { label: 'Time played', value: fmtDuration(s.seconds), hero: true },
    { label: 'Plays', value: fmtNum(s.plays) },
    { label: 'Different items', value: fmtNum(items.length) },
    ...common(s, 'plays'),
  ],
}

export const isAudiobooks = (library: Library) =>
  library.section_type === 'artist' && /audio\s*books?|podcasts?|books/i.test(library.section_name)

export function configFor(library: Library) {
  if (isAudiobooks(library)) return AUDIOBOOKS
  return CONFIGS[library.section_type] ?? FALLBACK
}

