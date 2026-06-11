import type { ReactNode } from 'react'
import { AppShell } from '../shared/app-shell'
import type { LayoutNavEntry } from '../shared/types'

type AdminLayoutProps = {
  children: ReactNode
  navItems: LayoutNavEntry[]
  roleLabelKey: string
}

export function AdminLayout({
  children,
  navItems,
  roleLabelKey,
}: AdminLayoutProps) {
  return (
    <AppShell
      navItems={navItems}
      productAreaKey="shell.productArea"
      roleLabelKey={roleLabelKey}
      titleKey="dashboard.title"
    >
      {children}
    </AppShell>
  )
}
