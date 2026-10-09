import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { makeIndex, makeProject, sampleIndex } from './test/fixtures'

const NOW = new Date('2026-10-08T12:00:00Z')

afterEach(() => {
  cleanup()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

function renderPage(data = sampleIndex) {
  return render(<App data={data} now={NOW} />)
}

/** Scoped to the KPI row: "Last push" is also one of the sort options. */
function statValue(label: string): HTMLElement {
  const row = document.querySelector('.stat-row')
  if (!row) throw new Error('the stat row is missing')
  const tile = within(row as HTMLElement)
    .getByText(label)
    .closest('.stat-tile')
  if (!tile) throw new Error(`no stat tile labelled ${label}`)
  return tile as HTMLElement
}

function listedProjects(): string[] {
  return screen
    .queryAllByRole('listitem')
    .filter((item) => item.classList.contains('project'))
    .map((item) => item.querySelector('.project-name')?.textContent ?? '')
}

describe('the index page', () => {
  it('lists every project, newest push first', () => {
    renderPage()
    expect(listedProjects()).toEqual([
      'claude-remote-dashboard',
      'personal-project-portfolio',
      'Unity-Game',
      'super-octo-memory',
    ])
    expect(screen.getByText(/Showing all 4 projects/)).toBeInTheDocument()
  })

  it('shows the five fields the index is for', () => {
    renderPage()
    const card = screen.getByRole('link', { name: 'claude-remote-dashboard' }).closest('.project')!

    // name -> repository, description, language, last push, live link
    expect(within(card as HTMLElement).getByRole('link', { name: 'claude-remote-dashboard' })).toHaveAttribute(
      'href',
      'https://github.com/MOTOMOTO2/claude-remote-dashboard',
    )
    expect(
      within(card as HTMLElement).getByText(/The phone half of claude-remote/),
    ).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('JavaScript')).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('22 minutes ago')).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('8 Oct 2026')).toBeInTheDocument()
    expect(
      within(card as HTMLElement).getByRole('link', { name: 'Open the live site for claude-remote-dashboard' }),
    ).toHaveAttribute('href', 'https://motomoto2.github.io/claude-remote-dashboard/')
  })

  it('says so when a project has no description, no language or no live link', () => {
    renderPage()
    const card = screen.getByRole('link', { name: 'Unity-Game' }).closest('.project') as HTMLElement
    expect(within(card).getByText(/No description on GitHub or in the README/)).toBeInTheDocument()
    expect(within(card).getByText('Not detected')).toBeInTheDocument()
    expect(within(card).getByText('None')).toBeInTheDocument()
  })

  it('summarises the index in the stat row', () => {
    renderPage()
    expect(within(statValue('Projects')).getByText('4')).toBeInTheDocument()
    expect(within(statValue('Live sites')).getByText('2')).toBeInTheDocument()
    expect(within(statValue('Languages')).getByText('3')).toBeInTheDocument()
    expect(within(statValue('Last push')).getByText('22 minutes ago')).toBeInTheDocument()
  })

  it('draws one bar segment per language bucket', () => {
    renderPage()
    const bar = screen.getByRole('group', { name: 'Share of projects by language' })
    const segments = within(bar).getAllByRole('button')
    expect(segments.map((segment) => segment.getAttribute('aria-label'))).toEqual([
      'JavaScript: 1 project, 25% of the index',
      'Python: 1 project, 25% of the index',
      'TypeScript: 1 project, 25% of the index',
      'No language: 1 project, 25% of the index',
    ])
  })

  it('filters by search across name, description and topics', () => {
    renderPage()
    const search = screen.getByRole('searchbox', { name: 'Search' })

    fireEvent.change(search, { target: { value: 'portfolio' } })
    expect(listedProjects()).toEqual(['personal-project-portfolio'])
    expect(screen.getByText(/Showing 1 of 4 projects/)).toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'supabase' } })
    expect(listedProjects()).toEqual(['claude-remote-dashboard'])

    fireEvent.change(search, { target: { value: 'nothing here' } })
    expect(listedProjects()).toEqual([])
    expect(screen.getByText(/Nothing matches those filters/)).toBeInTheDocument()
  })

  it('filters from the legend and keeps the select in step', () => {
    renderPage()
    const legend = screen.getByRole('list', { name: 'Filter by language' })

    fireEvent.click(within(legend).getByRole('button', { name: /^Python/ }))
    expect(listedProjects()).toEqual(['super-octo-memory'])
    expect(screen.getByLabelText('Language')).toHaveValue('Python')

    // Clicking the same language again clears the filter.
    fireEvent.click(within(legend).getByRole('button', { name: /^Python/ }))
    expect(listedProjects()).toHaveLength(4)
  })

  it('filters repositories with no detected language', () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: '(no language)' } })
    expect(listedProjects()).toEqual(['Unity-Game'])
  })

  it('hides forks on request', () => {
    renderPage()
    fireEvent.click(screen.getByLabelText('Hide forks'))
    expect(listedProjects()).not.toContain('super-octo-memory')
    expect(listedProjects()).toHaveLength(3)
  })

  it('re-sorts without losing the filters', () => {
    renderPage()
    fireEvent.click(screen.getByLabelText('Hide forks'))
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'name' } })
    expect(listedProjects()).toEqual(['claude-remote-dashboard', 'personal-project-portfolio', 'Unity-Game'])
  })

  it('clears every filter at once', () => {
    renderPage()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'portfolio' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(listedProjects()).toHaveLength(4)
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('')
  })

  it('links to the owner and dates the data', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'github.com/MOTOMOTO2' })).toHaveAttribute(
      'href',
      'https://github.com/MOTOMOTO2',
    )
    expect(screen.getByText(/Data fetched from the GitHub REST API/)).toBeInTheDocument()
  })

  it('warns when the data could not be refreshed', () => {
    renderPage(makeIndex(sampleIndex.projects, { stale: true }))
    expect(screen.getByRole('status')).toHaveTextContent(/could not reach the GitHub API/)
  })

  it('cycles the theme and remembers the choice', () => {
    renderPage()
    const toggle = screen.getByRole('button', { name: /^Theme:/ })

    expect(document.documentElement.dataset.theme).toBeUndefined()
    fireEvent.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('light')
    fireEvent.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('project-index-theme')).toBe('dark')
  })

  it('renders an account with no projects without falling over', () => {
    renderPage(makeIndex([]))
    expect(listedProjects()).toEqual([])
    expect(within(statValue('Projects')).getByText('0')).toBeInTheDocument()
    expect(within(statValue('Last push')).getByText('unknown')).toBeInTheDocument()
  })

  it('renders a single project with no live link', () => {
    renderPage(makeIndex([makeProject({ name: 'solo' })]))
    expect(listedProjects()).toEqual(['solo'])
    expect(screen.getByText(/Showing all 1 project$/)).toBeInTheDocument()
  })
})
