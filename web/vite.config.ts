import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project site from /<repo>/, so the bundle needs that
// prefix. The workflow passes it in from actions/configure-pages
// (PAGES_BASE=/github-project-index); locally the default is fine.
const rawBase = process.env.PAGES_BASE ?? process.env.VITE_BASE ?? '/github-project-index/'
const base = rawBase === '' ? '/' : rawBase.endsWith('/') ? rawBase : `${rawBase}/`

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
