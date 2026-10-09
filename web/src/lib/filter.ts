/** Search, filter and sort — pure, so the behaviour is unit-tested. */

import type { Project } from '../types'
import { NO_LANGUAGE_KEY, OTHER_KEY } from './languages'

export const SORTS = {
  pushed: 'Last push',
  name: 'Name (A–Z)',
  stars: 'Stars',
} as const

export type SortKey = keyof typeof SORTS

export interface Query {
  search: string
  /** A language name, NO_LANGUAGE_KEY, or null for "all languages". */
  language: string | null
  sort: SortKey
  hideForks: boolean
}

export const EMPTY_QUERY: Query = { search: '', language: null, sort: 'pushed', hideForks: false }

export function matchesSearch(project: Project, search: string): boolean {
  const term = search.trim().toLowerCase()
  if (!term) return true
  const haystack = [project.name, project.description ?? '', project.language ?? '', ...project.topics]
    .join(' ')
    .toLowerCase()
  // Every whitespace-separated word must appear somewhere.
  return term.split(/\s+/).every((word) => haystack.includes(word))
}

/**
 * `topLanguages` is the set of languages that own a colour slice; it is only
 * needed to resolve the legend's "Other" bucket back to repositories.
 */
export function matchesLanguage(
  project: Project,
  language: string | null,
  topLanguages?: ReadonlySet<string>,
): boolean {
  if (language === null) return true
  if (language === NO_LANGUAGE_KEY) return project.language === null
  if (language === OTHER_KEY) return project.language !== null && !topLanguages?.has(project.language)
  return project.language === language
}

export function sortProjects(projects: Project[], sort: SortKey): Project[] {
  const sorted = [...projects]
  switch (sort) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
    case 'stars':
      return sorted.sort((a, b) => b.stars - a.stars || b.pushed_at.localeCompare(a.pushed_at))
    case 'pushed':
    default:
      return sorted.sort((a, b) => b.pushed_at.localeCompare(a.pushed_at) || a.name.localeCompare(b.name))
  }
}

export function filterProjects(
  projects: Project[],
  query: Query,
  topLanguages?: ReadonlySet<string>,
): Project[] {
  const kept = projects.filter(
    (project) =>
      (!query.hideForks || !project.is_fork) &&
      matchesLanguage(project, query.language, topLanguages) &&
      matchesSearch(project, query.search),
  )
  return sortProjects(kept, query.sort)
}

export function isFiltered(query: Query): boolean {
  return query.search.trim() !== '' || query.language !== null || query.hideForks
}
