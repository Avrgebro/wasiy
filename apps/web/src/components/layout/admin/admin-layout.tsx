import type { ReactNode } from 'react'
import { AppShell } from '../shared/app-shell'
import type { LayoutNavEntry } from '../shared/types'

type AdminLayoutProps = {
  children: ReactNode
  navItems: LayoutNavEntry[]
}

export function AdminLayout({ children, navItems }: AdminLayoutProps) {
  return <AppShell navItems={navItems}>{children}</AppShell>
}
