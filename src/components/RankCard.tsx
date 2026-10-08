import { useState } from 'react'
import { imageUrl } from '../api'
import type { Ranked } from '../lib/aggregate'
import { fmtDuration, fmtInt, initials, plural } from '../lib/format'

type Noun = [one: string, many: string]
export type ArtShape = 'square' | 'round' | 'poster'

export interface RankCardProps {
  title: string
  subtitle?: string
  items: Ranked[]
  unit: Noun
  childUnit?: Noun
  art?: ArtShape
  /** Show a "N versions" badge when an entry merges several raw titles. */
  showVersions?: boolean
  limit?: number
  /** Show the top three as large artwork tiles. */
  podium?: boolean
}

function Art({ item, shape, size }: { item: Ranked; shape: ArtShape; size: number }) {
  const [failed, setFailed] = useState(false)
  const src = imageUrl(item.image, size)
  const cls = `art ${shape === 'round' ? 'round' : ''} ${shape === 'poster' ? 'poster' : ''}`
  if (!src || failed) return <span className={cls}>{initials(item.label)}</span>
  return <img className={cls} src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
}

function PodiumArt({ item, shape }: { item: Ranked; shape: ArtShape }) {
  const [failed, setFailed] = useState(false)
  const src = imageUrl(item.image, shape === 'poster' ? 400 : 500)
  return (
    <>
      <span className="initials">{initials(item.label)}</span>
      {src && !failed && <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} style={{ position: 'relative' }} />}
    </>
  )
}

export function RankCard({ title, subtitle, items, unit, childUnit, art = 'square', showVersions, limit = 10, podium: withPodium = true }: RankCardProps) {
  const [expanded, setExpanded] = useState(false)
  const shown = items.slice(0, expanded ? 50 : limit)
  const podium = items.slice(0, 3)
  const max = items[0]?.plays ?? 1

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="sub">{subtitle}</p>}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty">Nothing played in this period.</div>
      ) : (
        <>
          {withPodium && podium.length === 3 && (
            <div className="podium">
              {podium.map((item, i) => (
                <div key={item.key} className={`podium-item ${art === 'poster' ? 'poster' : ''}`} title={item.label}>
                  <PodiumArt item={item} shape={art} />
                  <span className="rank-num">{i + 1}</span>
                  <div className="caption">
                    <div className="t">{item.label}</div>
                    <div className="n">{plural(item.plays, unit[0], unit[1])}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <ol className="rank-list">
            {shown.map((item, i) => {
              const versions = showVersions ? item.variants.length : 0
              const meta = [
                item.sub,
                childUnit && item.children ? plural(item.children, childUnit[0], childUnit[1]) : null,
                fmtDuration(item.seconds),
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <li key={item.key} className="rank-row">
                  <span className="pos">{i + 1}</span>
                  <Art item={item} shape={art} size={96} />
                  <span className="name">
                    <div className="title" title={item.label}>
                      {item.label}
                      {versions > 1 && (
                        <span
                          className="badge"
                          title={item.variants.map((v) => `${v.title} — ${plural(v.plays, unit[0], unit[1])}`).join('\n')}
                        >
                          {versions} versions
                        </span>
                      )}
                    </div>
                    <div className="meta">{meta}</div>
                    <div className="bar" style={{ width: `${(item.plays / max) * 100}%` }} />
                  </span>
                  <span className="count">
                    {fmtInt(item.plays)}
                    <small>{item.plays === 1 ? unit[0] : unit[1]}</small>
                  </span>
                </li>
              )
            })}
          </ol>
          {items.length > limit && (
            <button className="more-btn" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'Show less' : `Show top ${Math.min(50, items.length)}`}
            </button>
          )}
        </>
      )}
    </section>
  )
}
