import { Button } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Brand } from '../shared/brand'
import { ColorSchemeToggle } from '../shared/color-scheme-toggle'
import type {
  LayoutNavCollapsible,
  LayoutNavEntry,
  LayoutNavGroup,
  LayoutNavItem,
  LayoutNavLeaf,
} from '../shared/types'

type PortalLayoutProps = {
  children: ReactNode
  navItems: LayoutNavEntry[]
}

function isGroup(entry: LayoutNavEntry): entry is LayoutNavGroup {
  return entry.type === 'group'
}

function isCollapsible(item: LayoutNavItem): item is LayoutNavCollapsible {
  return item.type === 'collapsible'
}

function flattenPortalNavItems(navItems: LayoutNavEntry[]): LayoutNavLeaf[] {
  return navItems.flatMap((entry) => {
    if (isGroup(entry)) {
      return entry.items.flatMap((item) =>
        isCollapsible(item) ? item.children : [item],
      )
    }

    return isCollapsible(entry) ? entry.children : [entry]
  })
}

export function PortalLayout({ children, navItems }: PortalLayoutProps) {
  const { t } = useTranslation('common')
  const portalNavItems = flattenPortalNavItems(navItems)

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="[&>div]:p-0">
            <Brand />
          </div>
          <div className="flex items-center gap-2">
            <nav
              className="hidden items-center gap-2 md:flex"
              aria-label={t('shell.mainNav')}
            >
              {portalNavItems.map((item) => (
                <Button component={Link} key={item.to} to={item.to} variant="subtle">
                  {t(item.labelKey)}
                </Button>
              ))}
            </nav>
            <ColorSchemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
