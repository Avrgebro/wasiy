import type { ReactNode } from 'react'
import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import type { LayoutNavEntry } from './types'

type AppShellProps = {
  accountKey?: string
  children: ReactNode
  navItems: LayoutNavEntry[]
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
  const [mobileNavOpened, setMobileNavOpened] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] [--sidebar-width:17rem]">
      <Sidebar
        mobileOpened={mobileNavOpened}
        navItems={navItems}
        onMobileClose={() => setMobileNavOpened(false)}
        productAreaKey={productAreaKey}
      />

      <div className="min-w-0">
        <Topbar
          accountKey={accountKey}
          onMobileNavOpen={() => setMobileNavOpened(true)}
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
