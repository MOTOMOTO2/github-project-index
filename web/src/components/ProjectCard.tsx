import type { Project } from '../types'
import { formatDate, formatDateTime, relativeTime } from '../lib/format'

const LIVE_SOURCE_LABEL: Record<string, string> = {
  homepage: 'Homepage',
  pages: 'GitHub Pages',
}

/** One row of the index: name, description, language, last push, live link. */
export function ProjectCard({
  project,
  languageColor,
  now,
}: {
  project: Project
  languageColor: string
  now: Date
}) {
  return (
    <li className="project">
      <div className="project-head">
        <h3 className="project-name">
          <a href={project.repo_url} target="_blank" rel="noreferrer noopener">
            {project.name}
          </a>
        </h3>
        <p className={project.description ? 'project-description' : 'project-description is-empty'}>
          {project.description ?? 'No description on GitHub or in the README yet.'}
        </p>
        <ul className="badges">
          {project.stars > 0 ? <li className="badge">{project.stars} ★</li> : null}
          {project.is_fork ? <li className="badge">Fork</li> : null}
          {project.is_archived ? <li className="badge">Archived</li> : null}
          {project.is_private ? <li className="badge">Private</li> : null}
          {project.topics.slice(0, 4).map((topic) => (
            <li className="badge badge-topic" key={topic}>
              {topic}
            </li>
          ))}
        </ul>
      </div>

      <dl className="project-meta">
        <div className="meta-field">
          <dt>Language</dt>
          <dd>
            <span className="dot" style={{ background: languageColor }} aria-hidden="true" />
            {project.language ?? 'Not detected'}
          </dd>
        </div>

        <div className="meta-field">
          <dt>Last push</dt>
          <dd>
            <time dateTime={project.pushed_at} title={formatDateTime(project.pushed_at)}>
              {relativeTime(project.pushed_at, now)}
            </time>
            <span className="meta-sub">{formatDate(project.pushed_at)}</span>
          </dd>
        </div>

        <div className="meta-field">
          <dt>Live link</dt>
          <dd>
            {project.live_url ? (
              <>
                <a
                  className="live-link"
                  href={project.live_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`Open the live site for ${project.name}`}
                >
                  Visit<span aria-hidden="true"> ↗</span>
                </a>
                <span className="meta-sub">
                  {LIVE_SOURCE_LABEL[project.live_url_source ?? ''] ?? 'Published'}
                </span>
              </>
            ) : (
              <span className="meta-none">None</span>
            )}
          </dd>
        </div>
      </dl>
    </li>
  )
}
