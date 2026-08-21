import type { ReactNode } from 'react'
import { useState } from 'react'
import { MobileLocationSheet } from './location-switcher'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import type { LayoutNavEntry } from './types'

type AppShellProps = {
  children: ReactNode
  navItems: LayoutNavEntry[]
}

export function AppShell({ children, navItems }: AppShellProps) {
  const [mobileNavOpened, setMobileNavOpened] = useState(false)
  const [mobileLocationOpened, setMobileLocationOpened] = useState(false)

  function openMobileLocationPicker() {
    setMobileNavOpened(false)
    setMobileLocationOpened(true)
  }

  return (
    <div className="min-h-screen bg-[var(--app-canvas)] text-[var(--mantine-color-text)] lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] [--sidebar-width:18rem]">
      <Sidebar
        mobileOpened={mobileNavOpened}
        navItems={navItems}
        onMobileClose={() => setMobileNavOpened(false)}
        onMobileLocationOpen={openMobileLocationPicker}
      />

      <div className="min-w-0">
        <Topbar
          navItems={navItems}
          onMobileNavOpen={() => setMobileNavOpened(true)}
        />
        <main className="px-4 pb-8 pt-2 lg:px-8">{children}</main>
      </div>

      <MobileLocationSheet
        onClose={() => setMobileLocationOpened(false)}
        opened={mobileLocationOpened}
      />
    </div>
  )
}
