import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
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
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  // The shell scrolls internally (see the root's fixed height), so the
  // browser's window-scroll reset on navigation never happens — do it here.
  useEffect(() => {
    scrollAreaRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  function openMobileLocationPicker() {
    setMobileNavOpened(false)
    setMobileLocationOpened(true)
  }

  return (
    // Fixed-height shell: the document never scrolls, only the content
    // column does. Keeps mobile/tablet browser chrome from expanding and
    // collapsing on scroll.
    <div className="h-dvh-safe overflow-hidden bg-[var(--app-canvas)] text-[var(--mantine-color-text)] lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] [--sidebar-width:18rem]">
      <Sidebar
        mobileOpened={mobileNavOpened}
        navItems={navItems}
        onMobileClose={() => setMobileNavOpened(false)}
        onMobileLocationOpen={openMobileLocationPicker}
      />

      {/* The topbar stays inside the scroller so its sticky under-scroll
          blur keeps working. */}
      <div className="h-full min-w-0 overflow-y-auto" ref={scrollAreaRef}>
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
