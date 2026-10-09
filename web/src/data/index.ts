import type { ProjectIndex } from '../types'
import raw from './projects.json'

/**
 * The index data, inlined into the bundle by Vite at build time.
 * `scripts/fetch_projects.py` regenerates projects.json from the GitHub API
 * before every build, so this file never needs touching by hand.
 */
export const projectIndex = raw as unknown as ProjectIndex
