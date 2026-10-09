import type { Query, SortKey } from '../lib/filter'
import { SORTS } from '../lib/filter'
import type { LanguageSlice } from '../lib/languages'

/** Search, language, sort and the fork toggle — one row above the list. */
export function Controls({
  query,
  slices,
  onChange,
}: {
  query: Query
  slices: LanguageSlice[]
  onChange: (next: Query) => void
}) {
  return (
    <form className="controls" role="search" onSubmit={(event) => event.preventDefault()}>
      <label className="control control-search">
        <span className="control-label">Search</span>
        <input
          type="search"
          value={query.search}
          placeholder="Name, description, language or topic"
          autoComplete="off"
          onChange={(event) => onChange({ ...query, search: event.target.value })}
        />
      </label>

      <label className="control">
        <span className="control-label">Language</span>
        <select
          value={query.language ?? ''}
          onChange={(event) => onChange({ ...query, language: event.target.value || null })}
        >
          <option value="">All languages</option>
          {slices.map((slice) => (
            <option key={slice.key} value={slice.key}>
              {slice.label} ({slice.count})
            </option>
          ))}
        </select>
      </label>

      <label className="control">
        <span className="control-label">Sort by</span>
        <select
          value={query.sort}
          onChange={(event) => onChange({ ...query, sort: event.target.value as SortKey })}
        >
          {Object.entries(SORTS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="control control-check">
        <input
          type="checkbox"
          checked={query.hideForks}
          onChange={(event) => onChange({ ...query, hideForks: event.target.checked })}
        />
        <span>Hide forks</span>
      </label>
    </form>
  )
}
