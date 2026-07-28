import type { ReactNode } from 'react'
import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import type { LayoutNavEntry } from './types'

type AppShellProps = {
  children: ReactNode
  navItems: LayoutNavEntry[]
  showNotifications?: boolean
}

export function AppShell({
  children,
  navItems,
  showNotifications,
}: AppShellProps) {
  const [mobileNavOpened, setMobileNavOpened] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--mantine-color-body)] text-[var(--mantine-color-text)] lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] [--sidebar-width:17rem]">
      <Sidebar
        mobileOpened={mobileNavOpened}
        navItems={navItems}
        onMobileClose={() => setMobileNavOpened(false)}
      />

      <div className="min-w-0">
        <Topbar
          onMobileNavOpen={() => setMobileNavOpened(true)}
          showNotifications={showNotifications}
        />
        <main className="px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  )
}
