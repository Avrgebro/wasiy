import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import './i18n'
import './index.css'
// Sora backs the font-display utility, which the app shell's Brand uses on
// every page — load it globally, not per-route, so it survives code
// splitting. Instrument Sans (font-brand) stays imported by the auth pages
// that use it.
import '@fontsource/sora/600.css'
import { queryClient } from './app/query-client'
import { router } from './app/router'
import { AppThemeProvider } from './app/app-theme-provider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
        <Notifications position="top-right" />
      </ModalsProvider>
    </AppThemeProvider>
  </StrictMode>,
)
