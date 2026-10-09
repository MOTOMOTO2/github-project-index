import type { Project, ProjectIndex } from '../types'

export function makeProject(overrides: Partial<Project> = {}): Project {
  const name = overrides.name ?? 'example'
  return {
    name,
    full_name: `MOTOMOTO2/${name}`,
    description: 'An example project',
    description_source: 'github',
    language: 'Python',
    topics: [],
    pushed_at: '2026-10-01T00:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    repo_url: `https://github.com/MOTOMOTO2/${name}`,
    live_url: null,
    live_url_source: null,
    stars: 0,
    forks: 0,
    is_fork: false,
    is_archived: false,
    is_private: false,
    ...overrides,
  }
}

export function makeIndex(projects: Project[], overrides: Partial<ProjectIndex> = {}): ProjectIndex {
  return {
    schema: 1,
    generated_at: '2026-10-08T06:00:00Z',
    stale: false,
    owner: {
      login: 'MOTOMOTO2',
      name: 'Moto',
      html_url: 'https://github.com/MOTOMOTO2',
      avatar_url: null,
      bio: null,
    },
    projects,
    ...overrides,
  }
}

/** A small index that exercises every shape the page has to render. */
export const sampleIndex = makeIndex([
  makeProject({
    name: 'claude-remote-dashboard',
    description: 'The phone half of claude-remote: queue coding jobs from anywhere.',
    description_source: 'readme',
    language: 'JavaScript',
    pushed_at: '2026-10-08T11:37:50Z',
    live_url: 'https://motomoto2.github.io/claude-remote-dashboard/',
    live_url_source: 'pages',
    topics: ['supabase'],
    stars: 4,
  }),
  makeProject({
    name: 'personal-project-portfolio',
    description: 'A portfolio site for showing off projects to employers.',
    description_source: 'readme',
    language: 'TypeScript',
    pushed_at: '2026-10-01T20:15:24Z',
    live_url: 'https://motomoto2.github.io/personal-project-portfolio/',
    live_url_source: 'pages',
  }),
  makeProject({
    name: 'Unity-Game',
    description: null,
    description_source: 'none',
    language: null,
    pushed_at: '2023-11-17T21:51:50Z',
  }),
  makeProject({
    name: 'super-octo-memory',
    description: null,
    description_source: 'none',
    language: 'Python',
    pushed_at: '2021-10-24T14:40:41Z',
    is_fork: true,
  }),
])
