export interface StatDef {
  label: string
  value: string
  hint?: string
  hero?: boolean
}

export function Stats({ stats }: { stats: StatDef[] }) {
  return (
    <div className="grid stats">
      {stats.map((s) => (
        <div key={s.label} className={`card stat ${s.hero ? 'hero-stat' : ''}`}>
          <div className="label">{s.label}</div>
          <div className="value">{s.value}</div>
          {s.hint && <div className="hint">{s.hint}</div>}
        </div>
      ))}
    </div>
  )
}
