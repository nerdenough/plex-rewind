import { useMemo } from 'react'
import type { Library, Play } from '../api'
import { HeatmapCard } from '../components/HeatmapCard'
import { RankCard } from '../components/RankCard'
import { Stats } from '../components/Stats'
import { TimelineCard } from '../components/TimelineCard'
import { rank, summarize, timeline } from '../lib/aggregate'
import { plural } from '../lib/format'
import { configFor } from './configs'

export function LibraryView({
  library,
  plays: allPlays,
  range,
}: {
  library: Library
  plays: Play[]
  range: { after: string; before: string }
}) {
  const cfg = configFor(library)

  const data = useMemo(() => {
    const plays = cfg.minSeconds ? allPlays.filter((p) => (p.play_duration ?? p.duration ?? 0) >= cfg.minSeconds) : allPlays
    const summary = summarize(plays)
    const ranks = cfg.ranks.map((r) => rank(plays, r.extract, r.child))
    const timelines = cfg.timelines.map((t) => timeline(plays, t.extract, range, t.single ? 0 : 8, t.child))
    return { plays, summary, ranks, timelines, skipped: allPlays.length - plays.length }
  }, [allPlays, cfg, range])

  if (data.plays.length === 0) {
    return (
      <div className="card empty">
        <h2 style={{ margin: '0 0 8px' }}>Nothing played yet</h2>
        No plays in {library.section_name} for this period. Try a wider date range.
      </div>
    )
  }

  return (
    <>
      <Stats stats={cfg.stats(data.summary, data.ranks)} />

      <div className="stack">
        {cfg.timelines.map((t, i) => (
          <TimelineCard
            key={t.title}
            title={t.title}
            subtitle={t.subtitle}
            timeline={data.timelines[i]}
            unit={cfg.unit}
            childUnit={t.childUnit}
            single={t.single}
            hideOther={t.hideOther}
          />
        ))}
      </div>

      <h3 className="section-title">The top of the charts</h3>
      <div className={`grid ${cfg.ranks.length >= 3 ? 'three' : 'two'}`}>
        {cfg.ranks.map((r, i) => (
          <RankCard
            key={r.title}
            title={r.title}
            subtitle={r.subtitle}
            items={data.ranks[i]}
            unit={cfg.unit}
            childUnit={r.childUnit}
            art={r.art}
            showVersions={r.showVersions}
          />
        ))}
      </div>

      <h3 className="section-title">Habits</h3>
      <div className="grid two">
        <HeatmapCard heat={data.summary.heat} unit={cfg.unit} />
        <RankCard
          title="Most played on"
          items={rank(data.plays, (p) => ({ key: p.player || p.platform, label: p.player || p.platform, sub: p.platform }))}
          unit={cfg.unit}
          art="round"
          limit={8}
          podium={false}
        />
      </div>

      {data.skipped > 0 && (
        <p className="footnote">
          {plural(data.skipped, 'play')} under {cfg.minSeconds}s treated as skips and left out.
        </p>
      )}
    </>
  )
}
