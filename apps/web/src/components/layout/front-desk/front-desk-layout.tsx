import type { ReactNode } from 'react'
import { AppShell } from '../shared/app-shell'
import { frontDeskNavItems } from './front-desk-nav'

type FrontDeskLayoutProps = {
  children: ReactNode
}

export function FrontDeskLayout({ children }: FrontDeskLayoutProps) {
  return (
    <AppShell
      navItems={frontDeskNavItems}
      productAreaKey="shell.frontDeskArea"
      roleLabelKey="roles.frontDesk"
      titleKey="frontDesk.title"
    >
      {children}
    </AppShell>
  )
}

