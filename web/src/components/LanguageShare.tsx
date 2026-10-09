import { useState } from 'react'
import type { LanguageSlice } from '../lib/languages'
import { formatShare, plural } from '../lib/format'

/**
 * Part-to-whole: one horizontal stacked bar of projects per language, with a
 * legend that doubles as the language filter. Segments are separated by a 2px
 * surface gap and the two ends are rounded; identity never rests on colour
 * alone because the legend labels every slice in text.
 *
 * Hovering or focusing a segment updates the readout line above the bar, which
 * is a tooltip that cannot be clipped by the card or run off a phone screen.
 */
export function LanguageShare({
  slices,
  total,
  selected,
  onSelect,
}: {
  slices: LanguageSlice[]
  total: number
  selected: string | null
  onSelect: (key: string | null) => void
}) {
  const [active, setActive] = useState<string | null>(null)
  if (slices.length === 0) return null

  const highlighted = slices.find((slice) => slice.key === (active ?? selected)) ?? null
  const named = slices.filter((slice) => !slice.neutral).length
  const readout = highlighted
    ? `${highlighted.label} · ${plural(highlighted.count, 'project')} · ${formatShare(highlighted.share)}`
    : `${plural(total, 'project')} across ${plural(named, 'language')}`

  const toggle = (key: string) => onSelect(selected === key ? null : key)

  return (
    <section className="share" aria-labelledby="share-heading">
      <div className="share-head">
        <h2 className="section-heading" id="share-heading">
          Projects by language
        </h2>
        <p className="share-readout" aria-hidden="true">
          {readout}
        </p>
      </div>

      <div className="share-bar" role="group" aria-label="Share of projects by language">
        {slices.map((slice) => (
          <button
            key={slice.key}
            type="button"
            className="share-segment"
            style={{ flexGrow: slice.count, background: slice.color }}
            aria-pressed={selected === slice.key}
            aria-label={`${slice.label}: ${plural(slice.count, 'project')}, ${formatShare(slice.share)} of the index`}
            onMouseEnter={() => setActive(slice.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(slice.key)}
            onBlur={() => setActive(null)}
            onClick={() => toggle(slice.key)}
          />
        ))}
      </div>

      <ul className="share-legend" aria-label="Filter by language">
        {slices.map((slice) => (
          <li key={slice.key}>
            <button
              type="button"
              className="legend-item"
              aria-pressed={selected === slice.key}
              onMouseEnter={() => setActive(slice.key)}
              onMouseLeave={() => setActive(null)}
              onClick={() => toggle(slice.key)}
            >
              <span className="legend-swatch" style={{ background: slice.color }} aria-hidden="true" />
              <span className="legend-label">{slice.label}</span>
              <span className="legend-count">{slice.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
