import { useCallback, useEffect, useState } from 'react'

/** Light/dark is a selected choice, not an automatic flip of the palette. */
export type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'project-index-theme'
const ORDER: Theme[] = ['system', 'light', 'dark']

export const THEME_LABELS: Record<Theme, string> = {
  system: 'Theme: system',
  light: 'Theme: light',
  dark: 'Theme: dark',
}

function readStored(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    /* private mode */
  }
  return 'system'
}

export function useTheme(): { theme: Theme; cycle: () => void } {
  const [theme, setTheme] = useState<Theme>(readStored)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* private mode */
    }
  }, [theme])

  const cycle = useCallback(() => {
    setTheme((current) => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? 'system')
  }, [])

  return { theme, cycle }
}
