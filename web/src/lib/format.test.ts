import { describe, expect, it } from 'vitest'
import { compactNumber, formatDate, formatDateTime, formatShare, plural, relativeTime } from './format'

const NOW = new Date('2026-10-08T12:00:00Z')

describe('relativeTime', () => {
  const cases: Array<[string, string]> = [
    ['2026-10-08T11:59:30Z', 'just now'],
    ['2026-10-08T11:30:00Z', '30 minutes ago'],
    ['2026-10-08T11:00:00Z', '1 hour ago'],
    ['2026-10-08T08:00:00Z', '4 hours ago'],
    ['2026-10-07T06:00:00Z', 'yesterday'],
    ['2026-10-03T12:00:00Z', '5 days ago'],
    ['2026-08-08T12:00:00Z', '2 months ago'],
    ['2025-12-08T12:00:00Z', '10 months ago'],
    ['2025-11-08T12:00:00Z', '1 year ago'], // never "12 months ago"
    ['2025-10-08T12:00:00Z', '1 year ago'],
    ['2024-10-08T12:00:00Z', '2 years ago'],
    ['2021-10-24T14:40:41Z', '4 years ago'],
  ]

  it.each(cases)('%s -> %s', (iso, expected) => {
    expect(relativeTime(iso, NOW)).toBe(expected)
  })

  it('treats clock skew into the future as "just now"', () => {
    expect(relativeTime('2026-10-09T00:00:00Z', NOW)).toBe('just now')
  })

  it('does not throw on missing or broken timestamps', () => {
    expect(relativeTime('', NOW)).toBe('unknown')
    expect(relativeTime('not a date', NOW)).toBe('unknown')
  })
})

describe('formatDate', () => {
  it('formats in UTC so every reader sees the push date GitHub reported', () => {
    expect(formatDate('2026-10-08T23:50:00Z')).toBe('8 Oct 2026')
  })

  it('falls back to a dash', () => {
    expect(formatDate('')).toBe('—')
  })

  it('spells out the time for the tooltip', () => {
    expect(formatDateTime('2026-10-08T11:37:50Z')).toContain('8 Oct 2026')
    expect(formatDateTime('')).toBe('unknown')
  })
})

describe('compactNumber', () => {
  it.each([
    [0, '0'],
    [7, '7'],
    [999, '999'],
    [1000, '1K'],
    [1250, '1.3K'],
    [12900, '12.9K'],
    [4_200_000, '4.2M'],
  ])('%i -> %s', (value, expected) => {
    expect(compactNumber(value)).toBe(expected)
  })
})

describe('formatShare and plural', () => {
  it('rounds shares to whole percent, keeping slivers visible', () => {
    expect(formatShare(0.25)).toBe('25%')
    expect(formatShare(0.125)).toBe('13%')
    expect(formatShare(0.004)).toBe('0.4%')
    expect(formatShare(0)).toBe('0%')
  })

  it('pluralises', () => {
    expect(plural(1, 'project')).toBe('1 project')
    expect(plural(4, 'project')).toBe('4 projects')
    expect(plural(2, 'language')).toBe('2 languages')
  })
})
