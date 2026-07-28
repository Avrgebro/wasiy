import type { ReactNode } from 'react'
import { AppShell } from '../shared/app-shell'
import type { LayoutNavEntry } from '../shared/types'

type FrontDeskLayoutProps = {
  children: ReactNode
  navItems: LayoutNavEntry[]
}

export function FrontDeskLayout({ children, navItems }: FrontDeskLayoutProps) {
  return (
    <AppShell navItems={navItems}>
      {children}
    </AppShell>
  )
}
