/**
 * Song-title normalization so that every version of a song (live, acoustic,
 * demo, remaster, early take, remix, etc.) collapses onto one key.
 */

const VERSION_WORDS = [
  'live', 'acoustic', 'demo', 'demos', 'remaster', 'remastered', 'remastering', 'early', 'take', 'takes', 'version', 'edit',
  'edited', 'mix', 'mixed', 'remix', 'rmx', 'mono', 'stereo', 'session', 'sessions', 'outtake', 'alternate', 'alt',
  'instrumental', 'unplugged', 'rehearsal', 'bonus', 'deluxe', 'single', 'radio', 'extended', 'original', 'bootleg', 'rough', 'piano',
  'orchestral', 'stripped', 'reworked', 'rework', 'rerecorded', 're-recorded', 'recording', 'recorded', 'mtv', 'bbc', 'peel', 'karaoke',
  'explicit', 'clean', 'censored', 'dub', 'unreleased', 'rarity', 'anniversary', 'feat', 'ft', 'featuring', 'with', 'from',
  'soundtrack', 'ost', 'performance', 'concert', 'tour', 'jam', 'vocal', 'acapella', 'unedited', 'mastered', 'master', 'backing', 'enhanced', 'tapes',
]
const VERSION_RE = new RegExp(`\\b(${VERSION_WORDS.map((w) => w.replace(/[-]/g, '\\-')).join('|')})\\b|\\b(19|20)\\d{2}\\b`, 'i')

// Trailing "(…)" or "[…]" group.
const TRAILING_GROUP = /\s*[([]+([^()[\]]*)[)\]]+\s*$/
// A YouTube video id tacked on by download tools, e.g. "[xOApXYhxJic]".
const VIDEO_ID = /\s*\[[A-Za-z0-9_-]{11}\]\s*$/
const DASH = /\s+[-–—]\s+/

const loose = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/** Strip version qualifiers, keeping original casing. Pass the artist to also drop "Artist - " prefixes. */
export function cleanTitle(title: string, artist?: string) {
  let t = title.trim().replace(VIDEO_ID, '')

  // "Song - Artist - Live - Venue" / "Artist - Song (Session)": drop segments naming the
  // artist, then cut at the first segment that reads as a version qualifier.
  const parts = t.split(DASH)
  if (parts.length > 1) {
    const a = artist ? loose(artist) : ''
    let kept = a ? parts.filter((p) => loose(p) !== a) : parts
    if (kept.length === 0) kept = parts
    const cut = kept.findIndex((p, i) => i > 0 && VERSION_RE.test(p))
    t = (cut > 0 ? kept.slice(0, cut) : kept).join(' - ')
  }

  for (let i = 0; i < 6; i++) {
    const g = t.match(TRAILING_GROUP)
    if (g && VERSION_RE.test(g[1])) {
      t = t.slice(0, g.index).trim()
      continue
    }
    break
  }
  return t.trim() || title.trim()
}

/** Comparison key: cleaned, lowercased, punctuation-free. */
export function titleKey(title: string, artist?: string) {
  return cleanTitle(title, artist)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’'`"“”]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function artistKey(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}
