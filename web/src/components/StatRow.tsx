/** A KPI row of stat tiles: label + value, no plot, so no hover layer. */

export interface Stat {
  label: string
  value: string
  hint?: string
}

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <dl className="stat-row">
      {stats.map((stat) => (
        <div className="stat-tile" key={stat.label}>
          <dt className="stat-label">{stat.label}</dt>
          <dd className="stat-value">
            {stat.value}
            {stat.hint ? <span className="stat-hint">{stat.hint}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}
