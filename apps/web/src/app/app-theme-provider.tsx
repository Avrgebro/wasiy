import { MantineProvider } from '@mantine/core'
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
      {children}
    </MantineProvider>
  )
}
