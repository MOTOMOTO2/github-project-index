/** Date and number formatting. Pure functions so the tests can pin "now". */

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY
// Switch to years a little before the 12-month mark: "12 months ago" reads worse
// than "1 year ago", and flooring exact years must not land a year short.
const MONTHS_UNTIL_YEARS = 11 * MONTH

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
})

function parse(iso: string): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

export function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count.toLocaleString('en-GB')} ${count === 1 ? noun : pluralNoun}`
}

/** "8 Oct 2026", or an em dash when the timestamp is missing. */
export function formatDate(iso: string): string {
  const date = parse(iso)
  return date ? DATE_FORMAT.format(date) : '—'
}

/** "8 Oct 2026, 11:37 UTC" — used for the title/tooltip on relative times. */
export function formatDateTime(iso: string): string {
  const date = parse(iso)
  return date ? DATE_TIME_FORMAT.format(date) : 'unknown'
}

/** "just now", "4 hours ago", "yesterday", "3 months ago", "2 years ago". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const date = parse(iso)
  if (!date) return 'unknown'
  const elapsed = now.getTime() - date.getTime()
  if (elapsed < 0) return 'just now'
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return ago(elapsed / MINUTE, 'minute')
  if (elapsed < DAY) return ago(elapsed / HOUR, 'hour')
  if (elapsed < 2 * DAY) return 'yesterday'
  if (elapsed < MONTH) return ago(elapsed / DAY, 'day')
  if (elapsed < MONTHS_UNTIL_YEARS) return ago(elapsed / MONTH, 'month')
  return ago(elapsed / YEAR, 'year')
}

function ago(value: number, unit: string): string {
  const count = Math.max(1, Math.floor(value))
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`
}

/** 0–999 as-is, then 1.2K / 12.9K / 4.2M — for stat-tile values. */
export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) < 1000) return String(Math.round(value))
  if (Math.abs(value) < 1_000_000) return `${trim(value / 1000)}K`
  return `${trim(value / 1_000_000)}M`
}

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}

/** 0.125 -> "13%" (shares are always rendered as whole percent). */
export function formatShare(share: number): string {
  if (!Number.isFinite(share) || share <= 0) return '0%'
  const percent = share * 100
  return `${percent < 1 ? percent.toFixed(1) : Math.round(percent)}%`
}
