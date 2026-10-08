import type { EChartsOption } from 'echarts'
import { useMemo, useState } from 'react'
import { escapeHtml, fmtInt } from '../lib/format'
import { useTheme } from '../lib/theme'
import { EChart } from './EChart'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hourLabel = (h: number) => (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`)

export function HeatmapCard({ heat, unit }: { heat: number[][]; unit: [string, string] }) {
  const theme = useTheme()
  const [table, setTable] = useState(false)
  const max = Math.max(1, ...heat.flat())

  const peak = useMemo(() => {
    let best = { d: 0, h: 0, v: -1 }
    heat.forEach((row, d) => row.forEach((v, h) => v > best.v && (best = { d, h, v })))
    return best
  }, [heat])

  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 8, top: 8, bottom: 56, containLabel: true },
      tooltip: {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        textStyle: { color: theme.text },
        extraCssText: 'border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.25);',
        formatter: (p: unknown) => {
          const [h, d, v] = (p as { value: [number, number, number] }).value
          return `<div class="tt"><div class="tt-head">${DAYS[d]} · ${hourLabel(h)}–${hourLabel((h + 1) % 24)}</div><div class="tt-row"><span class="tt-val">${fmtInt(v)}</span><span class="tt-label">${escapeHtml(v === 1 ? unit[0] : unit[1])}</span></div></div>`
        },
      },
      xAxis: {
        type: 'category',
        data: Array.from({ length: 24 }, (_, h) => hourLabel(h)),
        splitArea: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: theme.textMuted, fontSize: 10, interval: 2 },
      },
      yAxis: {
        type: 'category',
        data: DAYS,
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: theme.textMuted, fontSize: 11 },
      },
      visualMap: {
        min: 0,
        max,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 10,
        itemHeight: 160,
        text: ['More', 'Less'],
        textStyle: { color: theme.textMuted, fontSize: 11 },
        inRange: { color: [theme.seq0, theme.seqLo, theme.seqHi] },
      },
      series: [
        {
          type: 'heatmap',
          data: heat.flatMap((row, d) => row.map((v, h) => [h, d, v])),
          itemStyle: { borderColor: theme.surface, borderWidth: 2, borderRadius: 4 },
          emphasis: { itemStyle: { borderColor: theme.text, borderWidth: 1 } },
        },
      ],
    }),
    [heat, max, theme, unit],
  )

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>When you press play</h2>
          <p className="sub">
            {peak.v > 0 ? `Peak: ${DAYS[peak.d]}s around ${hourLabel(peak.h)}` : 'No activity'}
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Heatmap view">
          <button aria-pressed={!table} onClick={() => setTable(false)}>
            Chart
          </button>
          <button aria-pressed={table} onClick={() => setTable(true)}>
            Table
          </button>
        </div>
      </div>
      {table ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Hour</th>
                {DAYS.map((d) => (
                  <th key={d}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 24 }, (_, h) => (
                <tr key={h}>
                  <td>{hourLabel(h)}</td>
                  {DAYS.map((_, d) => (
                    <td key={d}>{heat[d][h] || '·'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EChart option={option} className="chart heat" />
      )}
    </section>
  )
}
