import type { ReactNode } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import type { LayoutNavItem } from './types'

type AppShellProps = {
  accountKey?: string
  children: ReactNode
  navItems: LayoutNavItem[]
  productAreaKey: string
  roleLabelKey?: string
  showLocationSwitcher?: boolean
  showNotifications?: boolean
  titleKey: string
}

export function AppShell({
  accountKey = 'shell.account',
  children,
  navItems,
  productAreaKey,
  roleLabelKey,
  showLocationSwitcher,
  showNotifications,
  titleKey,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Sidebar navItems={navItems} productAreaKey={productAreaKey} />

      <div className="lg:pl-64">
        <Topbar
          accountKey={accountKey}
          roleLabelKey={roleLabelKey}
          showLocationSwitcher={showLocationSwitcher}
          showNotifications={showNotifications}
          titleKey={titleKey}
        />
        <main className="px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  )
}

