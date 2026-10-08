export type SectionType = 'movie' | 'show' | 'artist' | 'photo' | string

export interface Library {
  section_id: string
  section_name: string
  section_type: SectionType
  count?: string
}

export interface User {
  user_id: number
  username: string
  friendly_name: string
}

export interface Play {
  date: number
  started: number
  stopped: number
  duration: number
  play_duration?: number
  paused_counter: number
  user_id: number
  friendly_name: string
  media_type: string
  rating_key: number
  parent_rating_key: number | ''
  grandparent_rating_key: number | ''
  full_title: string
  title: string
  parent_title: string
  grandparent_title: string
  original_title: string
  year: number | ''
  media_index: number | ''
  parent_media_index: number | ''
  thumb: string
  percent_complete: number
  watched_status: number
  platform: string
  player: string
}

interface Envelope<T> {
  response: { result: 'success' | 'error'; message: string | null; data: T }
}

export class ApiError extends Error {}

async function call<T>(cmd: string, params: Record<string, string | number> = {}, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams({ cmd, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })
  const res = await fetch(`/tautulli?${qs}`, { signal })
  if (!res.ok) throw new ApiError(`Tautulli returned HTTP ${res.status}`)
  const body = (await res.json()) as Envelope<T>
  if (body.response.result !== 'success') throw new ApiError(body.response.message || 'Tautulli request failed')
  return body.response.data
}

export function getLibraries(signal?: AbortSignal) {
  return call<Library[]>('get_libraries', {}, signal)
}

/** Look up a user by Plex username or Tautulli friendly name (case-insensitive). */
export async function findUser(name: string, signal?: AbortSignal) {
  const users = await call<User[]>('get_users', {}, signal)
  const n = name.trim().toLowerCase()
  const user = users.find((u) => u.username?.toLowerCase() === n || u.friendly_name?.toLowerCase() === n)
  if (!user) throw new ApiError(`No Tautulli user named "${name}".`)
  return user
}

interface HistoryPage {
  recordsFiltered: number
  recordsTotal: number
  data: Play[]
}

const PAGE_SIZE = 2500
const historyCache = new Map<string, Promise<Play[]>>()

/** All plays for a library between two dates (inclusive, YYYY-MM-DD). */
export function getHistory(
  opts: { sectionId: string; after: string; before: string; userId: number },
  onProgress?: (loaded: number, total: number) => void,
): Promise<Play[]> {
  const key = JSON.stringify(opts)
  const cached = historyCache.get(key)
  if (cached) return cached

  const load = async () => {
    const params: Record<string, string | number> = {
      section_id: opts.sectionId,
      after: opts.after,
      before: opts.before,
      user_id: opts.userId,
      grouping: 1,
      order_column: 'date',
      order_dir: 'asc',
      length: PAGE_SIZE,
    }
    const plays: Play[] = []
    for (let start = 0; ; start += PAGE_SIZE) {
      const page = await call<HistoryPage>('get_history', { ...params, start })
      plays.push(...page.data)
      onProgress?.(plays.length, page.recordsFiltered)
      if (page.data.length < PAGE_SIZE || plays.length >= page.recordsFiltered) break
    }
    return plays
  }

  const promise = load()
  historyCache.set(key, promise)
  promise.catch(() => historyCache.delete(key))
  return promise
}

/** URL for artwork via Tautulli's image proxy. */
export function imageUrl(ratingKey: number | string | '' | undefined, size = 300) {
  if (!ratingKey) return undefined
  const qs = new URLSearchParams({
    cmd: 'pms_image_proxy',
    rating_key: String(ratingKey),
    width: String(size),
    height: String(size),
    fallback: 'cover',
  })
  return `/tautulli?${qs}`
}
