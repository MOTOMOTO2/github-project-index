/**
 * Language buckets for the share bar and the legend.
 *
 * Colours are the validated categorical slots from the project palette, handed
 * out in a fixed order over the *whole* index — so filtering the list never
 * repaints the languages that survive. Slots run out at six: anything past
 * that folds into "Other", and repos GitHub reports no language for get their
 * own neutral bucket rather than a data colour.
 */

import type { Project } from '../types'

export const CATEGORICAL_SLOTS = 6
export const NO_LANGUAGE_KEY = '(no language)'
export const OTHER_KEY = '(other)'

export interface LanguageSlice {
  /** Value used by the language filter. */
  key: string
  label: string
  count: number
  share: number
  /** A CSS custom property reference, so light/dark swap for free. */
  color: string
  /** Neutral buckets ("Other", "No language") are not series colours. */
  neutral: boolean
}

export function countLanguages(projects: Project[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const project of projects) {
    const key = project.language ?? NO_LANGUAGE_KEY
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** Languages with a real name, most used first, ties broken alphabetically. */
export function rankedLanguages(projects: Project[]): string[] {
  return [...countLanguages(projects)]
    .filter(([key]) => key !== NO_LANGUAGE_KEY)
    .sort(([aKey, aCount], [bKey, bCount]) => bCount - aCount || aKey.localeCompare(bKey))
    .map(([key]) => key)
}

/** Fixed language -> palette slot assignment, derived from the full index. */
export function languageColors(projects: Project[]): Map<string, string> {
  const colors = new Map<string, string>()
  rankedLanguages(projects).forEach((language, position) => {
    if (position < CATEGORICAL_SLOTS) colors.set(language, `var(--series-${position + 1})`)
  })
  return colors
}

/**
 * The stacked-bar / legend breakdown. `projects` is always the full index so
 * the colours stay put; the caller highlights whatever is filtered.
 */
export function languageBreakdown(projects: Project[]): LanguageSlice[] {
  const counts = countLanguages(projects)
  const total = projects.length
  const colors = languageColors(projects)
  const share = (count: number) => (total === 0 ? 0 : count / total)

  const slices: LanguageSlice[] = []
  let otherCount = 0

  for (const language of rankedLanguages(projects)) {
    const count = counts.get(language) ?? 0
    const color = colors.get(language)
    if (color) {
      slices.push({ key: language, label: language, count, share: share(count), color, neutral: false })
    } else {
      otherCount += count
    }
  }

  if (otherCount > 0) {
    slices.push({
      key: OTHER_KEY,
      label: 'Other',
      count: otherCount,
      share: share(otherCount),
      color: 'var(--series-other)',
      neutral: true,
    })
  }

  const noLanguage = counts.get(NO_LANGUAGE_KEY) ?? 0
  if (noLanguage > 0) {
    slices.push({
      key: NO_LANGUAGE_KEY,
      label: 'No language',
      count: noLanguage,
      share: share(noLanguage),
      color: 'var(--series-none)',
      neutral: true,
    })
  }

  return slices
}

/** The dot beside a project's language in the list. */
export function colorForLanguage(language: string | null, colors: Map<string, string>): string {
  if (language === null) return 'var(--series-none)'
  return colors.get(language) ?? 'var(--series-other)'
}
