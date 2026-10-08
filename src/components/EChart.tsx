import * as echarts from 'echarts'
import { useEffect, useLayoutEffect, useRef } from 'react'

type Init = (chart: echarts.ECharts) => void | (() => void)

export function EChart({
  option,
  patch,
  className,
  onInit,
}: {
  option: echarts.EChartsOption
  /** Merged on top of `option`, for cheap updates (e.g. selection) that keep zoom state. */
  patch?: echarts.EChartsOption
  className?: string
  onInit?: Init
}) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const initRef = useRef(onInit)
  useLayoutEffect(() => {
    initRef.current = onInit
  })

  useEffect(() => {
    const c = echarts.init(el.current!, undefined, { renderer: 'canvas' })
    chart.current = c
    const cleanup = initRef.current?.(c)
    const ro = new ResizeObserver(() => c.resize())
    ro.observe(el.current!)
    return () => {
      cleanup?.()
      ro.disconnect()
      c.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true })
  }, [option])

  useEffect(() => {
    if (patch) chart.current?.setOption(patch)
  }, [option, patch])

  return <div ref={el} className={className ?? 'chart'} />
}
