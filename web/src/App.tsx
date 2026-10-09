import { useMemo, useState } from 'react'
import { Controls } from './components/Controls'
import { LanguageShare } from './components/LanguageShare'
import { ProjectCard } from './components/ProjectCard'
import { StatRow } from './components/StatRow'
import type { Stat } from './components/StatRow'
import { projectIndex } from './data'
import type { Query } from './lib/filter'
import { EMPTY_QUERY, filterProjects, isFiltered } from './lib/filter'
import { compactNumber, formatDate, formatDateTime, plural, relativeTime } from './lib/format'
import {
  CATEGORICAL_SLOTS,
  colorForLanguage,
  languageBreakdown,
  languageColors,
  rankedLanguages,
} from './lib/languages'
import { THEME_LABELS, useTheme } from './lib/theme'
import type { ProjectIndex } from './types'

const THEME_GLYPH = { system: '◐', light: '☀', dark: '☾' } as const

/** `data` and `now` are injectable so the tests can pin both. */
export default function App({ data = projectIndex, now }: { data?: ProjectIndex; now?: Date }) {
  const [query, setQuery] = useState<Query>(EMPTY_QUERY)
  const { theme, cycle } = useTheme()
  const { owner, projects, generated_at: generatedAt, stale } = data

  // One timestamp per mount, so every relative time on the page agrees.
  const [mountedAt] = useState(() => now ?? new Date())

  const slices = useMemo(() => languageBreakdown(projects), [projects])
  const colors = useMemo(() => languageColors(projects), [projects])
  const topLanguages = useMemo(
    () => new Set(rankedLanguages(projects).slice(0, CATEGORICAL_SLOTS)),
    [projects],
  )
  const visible = useMemo(() => filterProjects(projects, query, topLanguages), [projects, query, topLanguages])

  const liveCount = projects.filter((project) => project.live_url).length
  const languageCount = rankedLanguages(projects).length
  const lastPush = projects.reduce(
    (latest, project) => (project.pushed_at > latest ? project.pushed_at : latest),
    '',
  )

  const stats: Stat[] = [
    { label: 'Projects', value: compactNumber(projects.length) },
    { label: 'Live sites', value: compactNumber(liveCount), hint: `of ${projects.length} repositories` },
    { label: 'Languages', value: compactNumber(languageCount) },
    { label: 'Last push', value: relativeTime(lastPush, mountedAt), hint: formatDate(lastPush) },
  ]

  return (
    <div className="shell">
      <header className="masthead">
        <div className="masthead-identity">
          {owner.avatar_url ? (
            <img className="avatar" src={owner.avatar_url} alt="" width={56} height={56} loading="lazy" />
          ) : null}
          <div>
            <h1>Project index</h1>
            <p className="masthead-subtitle">
              Every public repository on{' '}
              <a href={owner.html_url} target="_blank" rel="noreferrer noopener">
                github.com/{owner.login}
              </a>
              , read from the GitHub API when this page was built.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={cycle}
          aria-label={THEME_LABELS[theme]}
          title={THEME_LABELS[theme]}
        >
          <span aria-hidden="true">{THEME_GLYPH[theme]}</span>
          <span className="theme-toggle-text">{theme}</span>
        </button>
      </header>

      {stale ? (
        <p className="notice" role="status">
          The last scheduled refresh could not reach the GitHub API, so this page is showing the
          snapshot taken on {formatDate(generatedAt)}.
        </p>
      ) : null}

      <main>
        <StatRow stats={stats} />

        <LanguageShare
          slices={slices}
          total={projects.length}
          selected={query.language}
          onSelect={(language) => setQuery({ ...query, language })}
        />

        <section aria-labelledby="projects-heading">
          <h2 className="section-heading" id="projects-heading">
            All projects
          </h2>

          <Controls query={query} slices={slices} onChange={setQuery} />

          <p className="result-count">
            <span aria-live="polite">
              {visible.length === projects.length
                ? `Showing all ${plural(projects.length, 'project')}`
                : `Showing ${visible.length} of ${plural(projects.length, 'project')}`}
            </span>
            {isFiltered(query) ? (
              <button type="button" className="link-button" onClick={() => setQuery(EMPTY_QUERY)}>
                Clear filters
              </button>
            ) : null}
          </p>

          {visible.length === 0 ? (
            <p className="empty">
              Nothing matches those filters.{' '}
              <button type="button" className="link-button" onClick={() => setQuery(EMPTY_QUERY)}>
                Clear them
              </button>
              .
            </p>
          ) : (
            <ul className="projects">
              {visible.map((project) => (
                <ProjectCard
                  key={project.full_name}
                  project={project}
                  languageColor={colorForLanguage(project.language, colors)}
                  now={mountedAt}
                />
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="page-footer">
        <p>
          Data fetched from the GitHub REST API on{' '}
          <time dateTime={generatedAt} title={formatDateTime(generatedAt)}>
            {formatDate(generatedAt)}
          </time>
          . A GitHub Actions workflow rebuilds and redeploys this page every Monday, so it keeps up
          with the repositories on its own.
        </p>
      </footer>
    </div>
  )
}
