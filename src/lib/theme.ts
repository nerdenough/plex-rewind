import { useEffect, useState } from 'react'

export interface Theme {
  surface: string
  surface2: string
  text: string
  textSecondary: string
  textMuted: string
  grid: string
  axis: string
  border: string
  series: string[]
  other: string
  seq0: string
  seqLo: string
  seqHi: string
  dark: boolean
}

function read(): Theme {
  const s = getComputedStyle(document.documentElement)
  const v = (n: string) => s.getPropertyValue(n).trim()
  return {
    surface: v('--surface-1'),
    surface2: v('--surface-2'),
    text: v('--text-primary'),
    textSecondary: v('--text-secondary'),
    textMuted: v('--text-muted'),
    grid: v('--grid'),
    axis: v('--axis'),
    border: v('--border'),
    series: Array.from({ length: 8 }, (_, i) => v(`--series-${i + 1}`)),
    other: v('--series-other'),
    seq0: v('--seq-0'),
    seqLo: v('--seq-lo'),
    seqHi: v('--seq-hi'),
    dark: s.colorScheme === 'dark' || v('color-scheme') === 'dark',
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(read)
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: light)')
    const update = () => setTheme(read())
    mq.addEventListener('change', update)
    const mo = new MutationObserver(update)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      mq.removeEventListener('change', update)
      mo.disconnect()
    }
  }, [])
  return theme
}
