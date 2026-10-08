import { useEffect, useMemo, useState } from 'react'
import { findUser, getHistory, getLibraries, type Library, type Play, type User } from './api'
import { fmtLong, fromISODate, rangeTitle, toISODate } from './lib/dates'
import { fmtInt } from './lib/format'
import { configFor, isAudiobooks } from './views/configs'
import { LibraryView } from './views/LibraryView'

type Preset = 'ytd' | 'last30' | 'last90' | 'last365' | 'lastyear' | 'custom'

const today = () => new Date()

function presetRange(p: Preset): { after: string; before: string } | null {
  const now = today()
  const daysAgo = (n: number) => toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n))
  switch (p) {
    case 'ytd':
      return { after: `${now.getFullYear()}-01-01`, before: toISODate(now) }
    case 'last30':
      return { after: daysAgo(29), before: toISODate(now) }
    case 'last90':
      return { after: daysAgo(89), before: toISODate(now) }
    case 'last365':
      return { after: daysAgo(364), before: toISODate(now) }
    case 'lastyear':
      return { after: `${now.getFullYear() - 1}-01-01`, before: `${now.getFullYear() - 1}-12-31` }
    default:
      return null
  }
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'ytd', label: 'Year to date' },
  { id: 'last30', label: '30 days' },
  { id: 'last90', label: '90 days' },
  { id: 'last365', label: '12 months' },
  { id: 'lastyear', label: String(today().getFullYear() - 1) },
  { id: 'custom', label: 'Custom' },
]

const TYPE_ORDER = ['artist', 'show', 'movie', 'audiobook']
const typeOf = (l: Library) => (isAudiobooks(l) ? 'audiobook' : l.section_type)

function TypeIcon({ type }: { type: string }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (type === 'artist')
    return (
      <svg {...common}>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    )
  if (type === 'audiobook')
    return (
      <svg {...common}>
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
    )
  if (type === 'show')
    return (
      <svg {...common}>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="m17 2-5 5-5-5" />
      </svg>
    )
  if (type === 'movie')
    return (
      <svg {...common}>
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
      </svg>
    )
  return (
    <svg {...common}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )
}

// ---------- URL state ----------

interface UrlState {
  lib?: string
  preset: Preset
  after?: string
  before?: string
}

function readUrl(): UrlState {
  const q = new URLSearchParams(location.search)
  const preset = (q.get('range') as Preset) || 'ytd'
  return {
    lib: q.get('lib') ?? undefined,
    preset: PRESETS.some((p) => p.id === preset) ? preset : 'ytd',
    after: q.get('from') ?? undefined,
    before: q.get('to') ?? undefined,
  }
}

function writeUrl(s: UrlState) {
  const q = new URLSearchParams()
  if (s.lib) q.set('lib', s.lib)
  if (s.preset !== 'ytd') q.set('range', s.preset)
  if (s.preset === 'custom' && s.after) q.set('from', s.after)
  if (s.preset === 'custom' && s.before) q.set('to', s.before)
  const qs = q.toString()
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname)
}

// ---------- app ----------

export default function App() {
  const [initial] = useState(readUrl)
  const [libraries, setLibraries] = useState<Library[] | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)

  const [libId, setLibId] = useState<string | undefined>(initial.lib)
  const [preset, setPreset] = useState<Preset>(initial.preset)
  const ytd = presetRange('ytd')!
  const [custom, setCustom] = useState({ after: initial.after ?? ytd.after, before: initial.before ?? ytd.before })

  const range = useMemo(() => {
    const r = presetRange(preset) ?? custom
    return r.after <= r.before ? r : { after: r.before, before: r.after }
  }, [preset, custom])

  useEffect(() => {
    const ctl = new AbortController()
    Promise.all([getLibraries(ctl.signal), findUser(__PLEX_USER__, ctl.signal)])
      .then(([libs, u]) => {
        const sorted = libs
          .filter((l) => l.section_type !== 'photo')
          .sort((a, b) => {
            const ai = TYPE_ORDER.indexOf(typeOf(a))
            const bi = TYPE_ORDER.indexOf(typeOf(b))
            return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.section_name.localeCompare(b.section_name)
          })
        setLibraries(sorted)
        setUser(u)
      })
      .catch((e: unknown) => {
        if (!ctl.signal.aborted) setBootError(e instanceof Error ? e.message : String(e))
      })
    return () => ctl.abort()
  }, [])

  const library = libraries?.find((l) => l.section_id === libId) ?? libraries?.[0]

  useEffect(() => {
    writeUrl({ lib: library?.section_id, preset, after: custom.after, before: custom.before })
  }, [library, preset, custom])

  // History for the current selection. Keep the previous result on screen while loading.
  const [result, setResult] = useState<{ key: string; plays: Play[]; library: Library; range: typeof range } | null>(null)
  const [progressState, setProgress] = useState<{ key: string; loaded: number; total: number } | null>(null)
  const [errorState, setLoadError] = useState<{ key: string; message: string } | null>(null)
  const requestKey = library ? JSON.stringify([library.section_id, range]) : ''

  useEffect(() => {
    if (!library || !user) return
    let cancelled = false
    getHistory({ sectionId: library.section_id, after: range.after, before: range.before, userId: user.user_id }, (loaded, total) => {
      if (!cancelled) setProgress({ key: requestKey, loaded, total })
    })
      .then((plays) => {
        if (cancelled) return
        setResult({ key: requestKey, plays, library, range })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setLoadError({ key: requestKey, message: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      cancelled = true
    }
  }, [library, range, user, requestKey])

  if (bootError) return <SetupError message={bootError} />

  const loadError = errorState?.key === requestKey ? errorState.message : null
  const busy = !!library && result?.key !== requestKey && !loadError
  const progress = busy ? (progressState?.key === requestKey ? progressState : { loaded: 0, total: 0 }) : null
  const cfg = library ? configFor(library) : null

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="" />
          Plex Rewind
        </div>
        <nav className="tabs" role="tablist" aria-label="Libraries">
          {libraries?.map((l) => (
            <button
              key={l.section_id}
              role="tab"
              className="tab"
              aria-selected={l.section_id === library?.section_id}
              onClick={() => setLibId(l.section_id)}
            >
              <TypeIcon type={typeOf(l)} />
              {l.section_name}
            </button>
          ))}
        </nav>
      </header>

      <div className="filters">
        <div className="segmented" role="group" aria-label="Date range">
          {PRESETS.map((p) => (
            <button key={p.id} aria-pressed={preset === p.id} onClick={() => setPreset(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <>
            <label className="field">
              From
              <input
                type="date"
                value={custom.after}
                max={custom.before}
                onChange={(e) => e.target.value && setCustom((c) => ({ ...c, after: e.target.value }))}
              />
            </label>
            <label className="field">
              To
              <input
                type="date"
                value={custom.before}
                min={custom.after}
                max={toISODate(today())}
                onChange={(e) => e.target.value && setCustom((c) => ({ ...c, before: e.target.value }))}
              />
            </label>
          </>
        )}
        <span className="spacer" />
        {progress && (
          <span className="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Loading {progress.total ? `${fmtInt(progress.loaded)} / ${fmtInt(progress.total)}` : '…'}
            <span className="progress">
              <div style={{ width: progress.total ? `${(progress.loaded / progress.total) * 100}%` : '15%' }} />
            </span>
          </span>
        )}
      </div>

      {library && cfg && (
        <section className="hero">
          <div className="eyebrow">{library.section_name}</div>
          <h1>
            {cfg.noun} in Review: <span className="year">{rangeTitle(range.after, range.before)}</span>
          </h1>
          <div className="meta">
            {fmtLong(fromISODate(range.after))} – {fmtLong(fromISODate(range.before))} · {user?.friendly_name}
          </div>
        </section>
      )}

      {loadError && (
        <div className="card error-box" style={{ marginBottom: 16 }}>
          <h2>Couldn't load history</h2>
          {loadError}
        </div>
      )}

      {!libraries && !bootError && <div className="empty">Connecting to Tautulli…</div>}

      {result && (
        <div className={`loading-veil ${busy ? 'busy' : ''}`}>
          <LibraryView
            key={result.library.section_id}
            library={result.library}
            plays={result.plays}
            range={result.range}
          />
        </div>
      )}
    </div>
  )
}

function SetupError({ message }: { message: string }) {
  const keyProblem = /apikey|api key/i.test(message)
  const userProblem = /no tautulli user/i.test(message)
  if (userProblem)
    return (
      <div className="app">
        <div className="card error-box" style={{ maxWidth: 640, margin: '10vh auto' }}>
          <h2>User not found</h2>
          <p>{message}</p>
          <p>
            Set <code>TAUTULLI_USER=your-plex-username</code> in <code>.env</code> and restart the dev server.
          </p>
        </div>
      </div>
    )
  return (
    <div className="app">
      <div className="card error-box" style={{ maxWidth: 640, margin: '10vh auto' }}>
        <h2>{keyProblem ? 'Tautulli API key needed' : "Can't reach Tautulli"}</h2>
        <p>{message}</p>
        <p>
          Create <code>.env.local</code> in the project root with:
        </p>
        <p>
          <code>TAUTULLI_API_KEY=your-key</code>
          <br />
          <code>TAUTULLI_URL=http://10.0.0.20:8181</code>
        </p>
        <p>Find the key in Tautulli under Settings → Web Interface → API, then restart the dev server.</p>
      </div>
    </div>
  )
}
