import type { EChartsOption } from 'echarts'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Timeline } from '../lib/aggregate'
import { fmtShort, fmtWeek, toISODate } from '../lib/dates'
import { escapeHtml, fmtInt, plural } from '../lib/format'
import { useTheme } from '../lib/theme'
import { EChart } from './EChart'

type Noun = [one: string, many: string]

export interface TimelineCardProps {
  title: string
  subtitle?: string
  timeline: Timeline
  unit: Noun
  childUnit?: Noun
  /** Plot weekly totals as one series instead of top-N entities. */
  single?: boolean
  hideOther?: boolean
}

type Mode = 'stacked' | 'lines' | 'table'

export function TimelineCard({ title, subtitle, timeline, unit, childUnit, single, hideOther }: TimelineCardProps) {
  const theme = useTheme()
  const [mode, setMode] = useState<Mode>('stacked')
  const lastActive = useMemo(() => {
    for (let i = timeline.totals.length - 1; i >= 0; i--) if (timeline.totals[i] > 0) return i
    return timeline.totals.length - 1
  }, [timeline])
  const [picked, setPicked] = useState<{ timeline: Timeline; index: number } | null>(null)
  // Reset the selection whenever the data changes.
  const selected = picked?.timeline === timeline ? picked.index : lastActive
  const select = useCallback((index: number) => setPicked({ timeline, index }), [timeline])
  const selectRef = useRef(select)
  useLayoutEffect(() => {
    selectRef.current = select
  })

  const colorOf = useMemo(() => {
    const m = new Map(timeline.series.map((s, i) => [s.item.key, theme.series[i % theme.series.length]]))
    return (key: string) => m.get(key) ?? theme.other
  }, [timeline, theme])

  const option = useMemo<EChartsOption>(() => {
    const { weeks, series, other, totals } = timeline
    const categories = weeks.map(toISODate)
    const stacked = mode === 'stacked'
    const noun = (n: number) => (n === 1 ? unit[0] : unit[1])

    const plotted = single
      ? [{ key: '__total', label: unit[1][0].toUpperCase() + unit[1].slice(1), values: totals, color: theme.series[0] }]
      : [
          ...series.map((s, i) => ({ key: s.item.key, label: s.item.label, values: s.values, color: theme.series[i] })),
          ...(stacked && !hideOther && other.some((v) => v > 0)
            ? [{ key: '__other', label: 'Everything else', values: other, color: theme.other }]
            : []),
        ]

    // Round only the top-most visible segment of each stacked column.
    const topOf = categories.map((_, w) => {
      for (let i = plotted.length - 1; i >= 0; i--) if (plotted[i].values[w] > 0) return i
      return -1
    })

    const zoomStart = weeks.length > 60 ? 100 - (52 / weeks.length) * 100 : 0

    const tooltipFormatter = (params: unknown) => {
      const arr = Array.isArray(params) ? params : [params]
      const w = (arr[0] as { dataIndex: number }).dataIndex
      const head = `<div class="tt-head">Week of ${escapeHtml(fmtWeek(weeks[w]))}</div>`
      let rows: string
      if (single) {
        rows = ''
      } else {
        const entries = series
          .map((s, i) => ({ label: s.item.label, sub: s.item.sub, v: s.values[w], kids: s.children[w], color: theme.series[i] }))
          .filter((e) => e.v > 0)
          .sort((a, b) => b.v - a.v)
        if (stacked && !hideOther && other[w] > 0) entries.push({ label: 'Everything else', sub: undefined, v: other[w], kids: 0, color: theme.other })
        rows = entries
          .map(
            (e) =>
              `<div class="tt-row"><span class="tt-key" style="background:${e.color}"></span><span class="tt-val">${fmtInt(e.v)}</span><span class="tt-label">${escapeHtml(e.label)}</span>${
                childUnit && e.kids
                  ? `<span class="tt-extra">${escapeHtml(plural(e.kids, childUnit[0], childUnit[1]))}</span>`
                  : e.sub
                    ? `<span class="tt-extra">${escapeHtml(e.sub)}</span>`
                    : ''
              }</div>`,
          )
          .join('')
      }
      const total = `<div class="tt-row ${rows ? 'tt-total' : ''}"><span class="tt-val">${fmtInt(totals[w])}</span><span class="tt-label">${noun(totals[w])} total</span></div>`
      const hint = `<div class="tt-head" style="margin:6px 0 0">Click for the full week</div>`
      return `<div class="tt">${head}${rows}${total}${hint}</div>`
    }

    return {
      animationDuration: 500,
      textStyle: { fontFamily: getComputedStyle(document.body).fontFamily },
      grid: { left: 8, right: 16, top: single ? 16 : 56, bottom: weeks.length > 12 ? 64 : 28, containLabel: true },
      legend: single
        ? { show: false }
        : {
            type: 'scroll',
            top: 0,
            left: 0,
            right: 0,
            icon: stacked ? 'roundRect' : 'path://M0,4h16v3H0z',
            itemWidth: stacked ? 10 : 16,
            itemHeight: stacked ? 10 : 3,
            itemGap: 16,
            textStyle: { color: theme.textSecondary, fontSize: 12 },
            pageTextStyle: { color: theme.textMuted },
            pageIconColor: theme.textSecondary,
            pageIconInactiveColor: theme.axis,
            inactiveColor: theme.axis,
            data: plotted.map((p) => p.label),
          },
      tooltip: {
        trigger: 'axis',
        axisPointer: stacked
          ? { type: 'shadow', shadowStyle: { color: theme.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' } }
          : { type: 'line', lineStyle: { color: theme.axis, width: 1 } },
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        padding: [10, 12],
        extraCssText: 'border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.25);',
        textStyle: { color: theme.text },
        confine: true,
        formatter: tooltipFormatter,
      },
      xAxis: {
        type: 'category',
        data: categories,
        boundaryGap: true,
        axisLine: { lineStyle: { color: theme.axis } },
        axisTick: { show: false },
        axisLabel: {
          color: theme.textMuted,
          fontSize: 11,
          hideOverlap: true,
          formatter: (v: string) => fmtShort(new Date(`${v}T00:00`)),
        },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: theme.grid, width: 1 } },
        axisLabel: { color: theme.textMuted, fontSize: 11 },
      },
      dataZoom:
        weeks.length > 12
          ? [
              { type: 'inside', start: zoomStart, end: 100, zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false },
              {
                type: 'slider',
                start: zoomStart,
                end: 100,
                height: 22,
                bottom: 8,
                borderColor: theme.border,
                backgroundColor: 'transparent',
                fillerColor: theme.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                dataBackground: { lineStyle: { color: theme.axis }, areaStyle: { color: theme.grid } },
                selectedDataBackground: { lineStyle: { color: theme.series[0] }, areaStyle: { color: theme.series[0], opacity: 0.15 } },
                handleStyle: { color: theme.surface, borderColor: theme.axis },
                moveHandleStyle: { color: theme.axis },
                textStyle: { color: theme.textMuted, fontSize: 10 },
                labelFormatter: (_: number, v: string) => (v ? fmtShort(new Date(`${v}T00:00`)) : ''),
              },
            ]
          : [],
      series: [
        ...plotted.map((p, i) =>
          stacked || single
            ? {
                id: p.key,
                name: p.label,
                type: 'bar' as const,
                stack: 'all',
                barMaxWidth: 24,
                barCategoryGap: '28%',
                emphasis: { focus: 'series' as const },
                itemStyle: { color: p.color, borderColor: theme.surface, borderWidth: 1 },
                data: p.values.map((v, w) => ({
                  value: v,
                  itemStyle: topOf[w] === i ? { borderRadius: [4, 4, 0, 0] } : undefined,
                })),
              }
            : {
                id: p.key,
                name: p.label,
                type: 'line' as const,
                smooth: 0.25,
                smoothMonotone: 'x' as const,
                showSymbol: false,
                symbol: 'circle',
                symbolSize: 8,
                lineStyle: { width: 2, color: p.color, cap: 'round' as const, join: 'round' as const },
                itemStyle: { color: p.color, borderColor: theme.surface, borderWidth: 2 },
                emphasis: { focus: 'series' as const },
                data: p.values,
              },
        ),
        { id: '__sel', type: 'line', data: [], silent: true, tooltip: { show: false } },
      ],
    }
  }, [timeline, mode, theme, unit, childUnit, single, hideOther])

  const patch = useMemo<EChartsOption>(
    () => ({
      series: [
        {
          id: '__sel',
          markLine: {
            silent: true,
            symbol: 'none',
            animation: false,
            label: { show: false },
            lineStyle: { color: theme.text, width: 1, type: 'solid', opacity: 0.5 },
            data: [{ xAxis: selected }],
          },
        },
      ],
    }),
    [selected, theme],
  )

  const onInit = useCallback((c: import('echarts').ECharts) => {
    const zr = c.getZr()
    const handler = (e: { offsetX: number; offsetY: number }) => {
      const pt = [e.offsetX, e.offsetY]
      if (!c.containPixel('grid', pt)) return
      const x = c.convertFromPixel({ gridIndex: 0 }, pt) as number[] | number
      const idx = Math.round(Array.isArray(x) ? x[0] : x)
      if (Number.isFinite(idx)) selectRef.current(idx)
    }
    zr.on('click', handler)
    return () => zr.off('click', handler)
  }, [])

  const week = timeline.perWeek[selected] ?? []
  const weekDate = timeline.weeks[selected]
  const weekTotal = timeline.totals[selected] ?? 0

  const chartToppers = useMemo(() => {
    const counts = new Map<string, { label: string; n: number }>()
    for (const w of timeline.perWeek) {
      const top = w[0]
      if (!top) continue
      const c = counts.get(top.key) ?? { label: top.label, n: 0 }
      c.n++
      counts.set(top.key, c)
    }
    return [...counts.values()].sort((a, b) => b.n - a.n)[0]
  }, [timeline])

  const maxInWeek = week[0]?.plays ?? 1

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="sub">{subtitle}</p>}
        </div>
        <div className="card-actions">
          <div className="segmented" role="group" aria-label="Chart view">
            {(single ? (['stacked', 'table'] as Mode[]) : (['stacked', 'lines', 'table'] as Mode[])).map((m) => (
              <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
                {m === 'stacked' ? (single ? 'Chart' : 'Stacked') : m === 'lines' ? 'Lines' : 'Table'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="timeline-body">
        <div className="timeline-main">
          {mode === 'table' ? (
            <TimelineTable timeline={timeline} single={single} unit={unit} />
          ) : (
            <EChart option={option} patch={patch} onInit={onInit} />
          )}
        </div>

        <aside className="week-panel" aria-live="polite">
          <div className="week-nav">
            <button className="icon-btn" aria-label="Previous week" disabled={selected <= 0} onClick={() => select(selected - 1)}>
              ‹
            </button>
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <div className="week-title">{weekDate ? `Week of ${fmtWeek(weekDate)}` : '—'}</div>
            </div>
            <button
              className="icon-btn"
              aria-label="Next week"
              disabled={selected >= timeline.weeks.length - 1}
              onClick={() => select(selected + 1)}
            >
              ›
            </button>
          </div>
          <div className="week-sub" style={{ textAlign: 'center' }}>
            {plural(weekTotal, unit[0], unit[1])}
            {!single && week.length > 0 && ` · ${fmtInt(week.length)} different`}
          </div>
          <div className="week-list">
            {week.length === 0 ? (
              <div className="empty" style={{ padding: '24px 0' }}>
                Nothing this week.
              </div>
            ) : (
              <ol className="rank-list">
                {week.slice(0, 10).map((r, i) => (
                  <li key={r.key} className="rank-row compact">
                    <span className="pos">{i + 1}</span>
                    <span className="swatch" style={{ background: single ? theme.series[0] : colorOf(r.key) }} />
                    <span className="name">
                      <div className="title" title={r.label}>
                        {r.label}
                      </div>
                      <div className="meta">
                        {[r.sub, childUnit && r.children ? plural(r.children, childUnit[0], childUnit[1]) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      <div className="bar" style={{ width: `${(r.plays / maxInWeek) * 100}%`, opacity: 0.35 }} />
                    </span>
                    <span className="count">{fmtInt(r.plays)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {!single && chartToppers && (
            <p className="footnote">
              Most weeks at #1: <strong>{chartToppers.label}</strong> ({plural(chartToppers.n, 'week')})
            </p>
          )}
        </aside>
      </div>
    </section>
  )
}

function TimelineTable({ timeline, single, unit }: { timeline: Timeline; single?: boolean; unit: Noun }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Week</th>
            {!single && timeline.series.map((s) => <th key={s.item.key}>{s.item.label}</th>)}
            {!single && <th>Everything else</th>}
            <th>Total {unit[1]}</th>
            {!single && <th>Week #1</th>}
          </tr>
        </thead>
        <tbody>
          {timeline.weeks.map((w, i) => (
            <tr key={i}>
              <td>{fmtWeek(w)}</td>
              {!single && timeline.series.map((s) => <td key={s.item.key}>{s.values[i] || '·'}</td>)}
              {!single && <td>{timeline.other[i] || '·'}</td>}
              <td>
                <strong>{timeline.totals[i]}</strong>
              </td>
              {!single && <td style={{ textAlign: 'left' }}>{timeline.perWeek[i][0]?.label ?? '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
