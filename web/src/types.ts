/** Shapes of the document written by scripts/fetch_projects.py. */

export type DescriptionSource = 'github' | 'readme' | 'none'
export type LiveUrlSource = 'homepage' | 'pages' | null

export interface Project {
  name: string
  full_name: string
  description: string | null
  description_source: DescriptionSource
  language: string | null
  topics: string[]
  pushed_at: string
  created_at: string
  repo_url: string
  live_url: string | null
  live_url_source: LiveUrlSource
  stars: number
  forks: number
  is_fork: boolean
  is_archived: boolean
  is_private: boolean
}

export interface Owner {
  login: string
  name: string
  html_url: string
  avatar_url: string | null
  bio: string | null
}

export interface ProjectIndex {
  schema: number
  /** When the GitHub API was last read, ISO-8601 UTC. */
  generated_at: string
  /** True when a refresh failed and the committed snapshot was reused. */
  stale: boolean
  owner: Owner
  projects: Project[]
}
