import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'

// One codebase, two artifacts. `vite --mode portal` builds the resident
// portal from src/routes-portal; any other mode builds the staff app from
// src/routes-admin. The alias below is the only place a bundle learns its
// route tree, so the other surface is never imported and never shipped.
export default defineConfig(({ mode }) => {
  const surface = mode === 'portal' ? 'portal' : 'admin'

  // Public build facts, set here rather than in .env files (which the repo
  // ignores for secrets). Vite reads VITE_* from process.env into
  // import.meta.env and into %VITE_*% placeholders in index.html.
  process.env.VITE_SURFACE = surface
  process.env.VITE_APP_TITLE = surface === 'portal' ? 'Wasiy Residentes' : 'Wasiy'
  process.env.VITE_MANIFEST = `/manifest.${surface}.webmanifest`
  // Where the other surface lives, for the no-access hand-off. Production
  // sets these in Vercel (app.wasiy.co / portal.wasiy.co).
  process.env.VITE_APP_URL ??= 'http://localhost:5174'
  process.env.VITE_PORTAL_URL ??= 'http://localhost:5175'

  return {
    plugins: [
      tanstackRouter({
        target: 'react',
        quoteStyle: 'single',
        routesDirectory: `./src/routes-${surface}`,
        generatedRouteTree: `./src/routeTree.${surface}.gen.ts`,
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@surface/routeTree': path.resolve(__dirname, `src/routeTree.${surface}.gen.ts`),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
    server: {
      port: surface === 'portal' ? 5175 : 5174,
      strictPort: true,
    },
    preview: {
      port: surface === 'portal' ? 4175 : 4174,
      strictPort: true,
    },
  }
})
