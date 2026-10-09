import { describe, expect, it } from 'vitest'
import { makeProject, sampleIndex } from '../test/fixtures'
import { EMPTY_QUERY, filterProjects, isFiltered, matchesLanguage, matchesSearch, sortProjects } from './filter'
import { NO_LANGUAGE_KEY, OTHER_KEY } from './languages'

const projects = sampleIndex.projects
const names = (list: typeof projects) => list.map((project) => project.name)

describe('matchesSearch', () => {
  const project = makeProject({
    name: 'claude-remote-dashboard',
    description: 'Queue coding jobs from anywhere',
    language: 'JavaScript',
    topics: ['supabase'],
  })

  it('matches on name, description, language and topics', () => {
    expect(matchesSearch(project, 'dashboard')).toBe(true)
    expect(matchesSearch(project, 'queue coding')).toBe(true)
    expect(matchesSearch(project, 'javascript')).toBe(true)
    expect(matchesSearch(project, 'supabase')).toBe(true)
  })

  it('requires every word and ignores case and padding', () => {
    expect(matchesSearch(project, '  REMOTE   jobs ')).toBe(true)
    expect(matchesSearch(project, 'remote python')).toBe(false)
  })

  it('an empty search matches everything', () => {
    expect(matchesSearch(project, '   ')).toBe(true)
  })

  it('survives a project with no description or language', () => {
    const bare = makeProject({ name: 'bare', description: null, language: null })
    expect(matchesSearch(bare, 'bare')).toBe(true)
    expect(matchesSearch(bare, 'python')).toBe(false)
  })
})

describe('matchesLanguage', () => {
  const python = makeProject({ language: 'Python' })
  const unknown = makeProject({ language: null })

  it('passes everything through when no language is selected', () => {
    expect(matchesLanguage(python, null)).toBe(true)
    expect(matchesLanguage(unknown, null)).toBe(true)
  })

  it('matches an exact language', () => {
    expect(matchesLanguage(python, 'Python')).toBe(true)
    expect(matchesLanguage(python, 'Go')).toBe(false)
  })

  it('handles the no-language bucket', () => {
    expect(matchesLanguage(unknown, NO_LANGUAGE_KEY)).toBe(true)
    expect(matchesLanguage(python, NO_LANGUAGE_KEY)).toBe(false)
  })

  it('resolves the Other bucket against the languages that own a slot', () => {
    const slotted = new Set(['Python'])
    expect(matchesLanguage(makeProject({ language: 'Rust' }), OTHER_KEY, slotted)).toBe(true)
    expect(matchesLanguage(python, OTHER_KEY, slotted)).toBe(false)
    expect(matchesLanguage(unknown, OTHER_KEY, slotted)).toBe(false)
  })
})

describe('sortProjects', () => {
  it('defaults to the most recent push', () => {
    expect(names(sortProjects(projects, 'pushed'))).toEqual([
      'claude-remote-dashboard',
      'personal-project-portfolio',
      'Unity-Game',
      'super-octo-memory',
    ])
  })

  it('sorts by name without case surprises', () => {
    expect(names(sortProjects(projects, 'name'))).toEqual([
      'claude-remote-dashboard',
      'personal-project-portfolio',
      'super-octo-memory',
      'Unity-Game',
    ])
  })

  it('sorts by stars, breaking ties on the last push', () => {
    expect(names(sortProjects(projects, 'stars'))[0]).toBe('claude-remote-dashboard')
  })

  it('does not mutate its input', () => {
    const before = names(projects)
    sortProjects(projects, 'name')
    expect(names(projects)).toEqual(before)
  })
})

describe('filterProjects', () => {
  it('returns everything, newest push first, for the default query', () => {
    expect(names(filterProjects(projects, EMPTY_QUERY))).toHaveLength(4)
  })

  it('combines search, language and the fork toggle', () => {
    expect(names(filterProjects(projects, { ...EMPTY_QUERY, search: 'portfolio' }))).toEqual([
      'personal-project-portfolio',
    ])
    expect(names(filterProjects(projects, { ...EMPTY_QUERY, language: 'Python' }))).toEqual([
      'super-octo-memory',
    ])
    expect(names(filterProjects(projects, { ...EMPTY_QUERY, language: 'Python', hideForks: true }))).toEqual([])
    expect(names(filterProjects(projects, { ...EMPTY_QUERY, hideForks: true }))).toHaveLength(3)
  })

  it('reports when a query is narrowing anything', () => {
    expect(isFiltered(EMPTY_QUERY)).toBe(false)
    expect(isFiltered({ ...EMPTY_QUERY, search: '  ' })).toBe(false)
    expect(isFiltered({ ...EMPTY_QUERY, search: 'x' })).toBe(true)
    expect(isFiltered({ ...EMPTY_QUERY, language: 'Python' })).toBe(true)
    expect(isFiltered({ ...EMPTY_QUERY, hideForks: true })).toBe(true)
    expect(isFiltered({ ...EMPTY_QUERY, sort: 'name' })).toBe(false)
  })
})
