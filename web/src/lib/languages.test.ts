import { describe, expect, it } from 'vitest'
import { makeProject } from '../test/fixtures'
import {
  CATEGORICAL_SLOTS,
  NO_LANGUAGE_KEY,
  OTHER_KEY,
  colorForLanguage,
  countLanguages,
  languageBreakdown,
  languageColors,
  rankedLanguages,
} from './languages'

const projects = [
  makeProject({ name: 'a', language: 'Python' }),
  makeProject({ name: 'b', language: 'Python' }),
  makeProject({ name: 'c', language: 'TypeScript' }),
  makeProject({ name: 'd', language: null }),
]

describe('countLanguages', () => {
  it('buckets repositories with no detected language', () => {
    const counts = countLanguages(projects)
    expect(counts.get('Python')).toBe(2)
    expect(counts.get('TypeScript')).toBe(1)
    expect(counts.get(NO_LANGUAGE_KEY)).toBe(1)
  })
})

describe('rankedLanguages', () => {
  it('orders by use, then alphabetically, and never includes the empty bucket', () => {
    expect(rankedLanguages(projects)).toEqual(['Python', 'TypeScript'])
    const tied = [
      makeProject({ name: 'x', language: 'Rust' }),
      makeProject({ name: 'y', language: 'Go' }),
    ]
    expect(rankedLanguages(tied)).toEqual(['Go', 'Rust'])
  })
})

describe('languageColors', () => {
  it('hands out the validated slots in order', () => {
    const colors = languageColors(projects)
    expect(colors.get('Python')).toBe('var(--series-1)')
    expect(colors.get('TypeScript')).toBe('var(--series-2)')
  })

  it('is computed from the whole index, so filtering cannot repaint a language', () => {
    const everything = languageColors(projects)
    const justTypeScript = languageColors(projects.filter((p) => p.language === 'TypeScript'))
    // The caller always passes the full index; this documents why.
    expect(everything.get('TypeScript')).toBe('var(--series-2)')
    expect(justTypeScript.get('TypeScript')).toBe('var(--series-1)')
  })

  it('runs out of slots rather than inventing hues', () => {
    const many = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((language) =>
      makeProject({ name: language, language }),
    )
    expect([...languageColors(many).keys()]).toHaveLength(CATEGORICAL_SLOTS)
  })
})

describe('languageBreakdown', () => {
  it('returns one slice per language with shares that add up', () => {
    const slices = languageBreakdown(projects)
    expect(slices.map((slice) => slice.key)).toEqual(['Python', 'TypeScript', NO_LANGUAGE_KEY])
    expect(slices.map((slice) => slice.count)).toEqual([2, 1, 1])
    expect(slices.reduce((total, slice) => total + slice.share, 0)).toBeCloseTo(1)
  })

  it('marks the no-language bucket neutral and puts it last', () => {
    const slices = languageBreakdown(projects)
    const last = slices.at(-1)
    expect(last?.label).toBe('No language')
    expect(last?.neutral).toBe(true)
    expect(last?.color).toBe('var(--series-none)')
  })

  it('folds everything past the sixth language into Other', () => {
    const many = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((language) =>
      makeProject({ name: language, language }),
    )
    const slices = languageBreakdown(many)
    const other = slices.find((slice) => slice.key === OTHER_KEY)
    expect(slices.filter((slice) => !slice.neutral)).toHaveLength(CATEGORICAL_SLOTS)
    expect(other?.count).toBe(2)
    expect(other?.color).toBe('var(--series-other)')
  })

  it('handles an empty index', () => {
    expect(languageBreakdown([])).toEqual([])
  })
})

describe('colorForLanguage', () => {
  it('uses the neutral steps for unknown and unslotted languages', () => {
    const colors = languageColors(projects)
    expect(colorForLanguage('Python', colors)).toBe('var(--series-1)')
    expect(colorForLanguage(null, colors)).toBe('var(--series-none)')
    expect(colorForLanguage('Brainfuck', colors)).toBe('var(--series-other)')
  })
})
