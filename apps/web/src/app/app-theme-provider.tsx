import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import 'dayjs/locale/es'
import { useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { router } from './router'
import { cssVariablesResolver, mantineTheme } from './theme'

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const registration = useRouterState({
    router,
    select: state => state.location.pathname.replace(/\/$/, '') === '/registro',
  })

  // Force light only on registration without changing the saved preference.
  return (
    <MantineProvider
      theme={mantineTheme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="auto"
      forceColorScheme={registration ? 'light' : undefined}
    >
      {/* Dates components speak Spanish, weeks start on Monday. Values stay
          YYYY-MM-DD / HH:mm wall-clock strings, matching the API (ADR 0041). */}
      <DatesProvider settings={{ locale: 'es', firstDayOfWeek: 1, weekendDays: [0, 6] }}>{children}</DatesProvider>
    </MantineProvider>
  )
}
