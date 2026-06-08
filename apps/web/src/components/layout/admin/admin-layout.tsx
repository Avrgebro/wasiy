import type { ReactNode } from 'react'
import { AppShell } from '../shared/app-shell'
import { adminNavItems } from './admin-nav'

type AdminLayoutProps = {
  children: ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AppShell
      navItems={adminNavItems}
      productAreaKey="shell.productArea"
      roleLabelKey="roles.locationManager"
      titleKey="dashboard.title"
    >
      {children}
    </AppShell>
  )
}

