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
    // Fixed-height shell (100% chain from html/body/#root in index.css —
    // the always-visible small viewport): the document never scrolls, only
    // the content column does. Keeps mobile/tablet browser chrome from
    // expanding and collapsing on scroll.
    // grid-rows minmax(0,1fr) is load-bearing: without it the implicit auto
    // row grows to fit the content, past the fixed shell height, and the
    // content column never gets a scrollable constraint.
    <div className="h-full overflow-hidden bg-[var(--app-canvas)] text-[var(--mantine-color-text)] xl:grid xl:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)] [--sidebar-width:24rem] xl:[--sidebar-width:18rem]">
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
