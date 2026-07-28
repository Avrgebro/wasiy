import { useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Brand } from './brand'
import { LocationSwitcher } from './location-switcher'
import { SidebarItemGroup } from './sidebar-item-group'
import { SidebarItem } from './sidebar-item'
import type { LayoutNavEntry, LayoutNavItem, LayoutNavLeaf } from './types'

type SidebarProps = {
  mobileOpened: boolean
  navItems: LayoutNavEntry[]
  onMobileClose: () => void
}

function isActivePath(pathname: string, item: LayoutNavLeaf) {
  const { activeMatch = 'exact', to } = item

  if (to === '/') {
    return pathname === '/'
  }

  if (activeMatch === 'prefix') {
    return pathname === to || pathname.startsWith(`${to}/`)
  }

  return pathname === to
}

function isGroup(entry: LayoutNavEntry) {
  return entry.type === 'group'
}

function SidebarItemList({
  items,
  onNavigate,
  pathname,
}: {
  items: LayoutNavItem[]
  onNavigate?: () => void
  pathname: string
}) {
  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <SidebarItem
          active={(item) => isActivePath(pathname, item)}
          item={item}
          key={item.type === 'collapsible' ? item.labelKey : item.to}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  )
}

function SidebarNav({
  navItems,
  onNavigate,
}: {
  navItems: LayoutNavEntry[]
  onNavigate?: () => void
}) {
  const { t } = useTranslation('common')
  // Reactive router state, not window.location: with client-side navigation
  // the document URL updates without a re-render.
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <nav className="flex flex-1 flex-col gap-4" aria-label={t('shell.mainNav')}>
      {navItems.map((entry) => {
        if (isGroup(entry)) {
          return (
            <SidebarItemGroup key={entry.titleKey} title={t(entry.titleKey)}>
              <SidebarItemList
                items={entry.items}
                onNavigate={onNavigate}
                pathname={pathname}
              />
            </SidebarItemGroup>
          )
        }

        return (
          <SidebarItem
            active={(item) => isActivePath(pathname, item)}
            item={entry}
            key={entry.type === 'collapsible' ? entry.labelKey : entry.to}
            onNavigate={onNavigate}
          />
        )
      })}
    </nav>
  )
}

function SidebarContent({
  navItems,
  onNavigate,
}: {
  navItems: LayoutNavEntry[]
  onNavigate?: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Brand />
      <div className="pb-4">
        <LocationSwitcher />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <SidebarNav navItems={navItems} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

export function Sidebar({
  mobileOpened,
  navItems,
  onMobileClose,
}: SidebarProps) {
  const { t } = useTranslation('common')

  return (
    <>
      {mobileOpened ? (
        <button
          aria-label={t('shell.closeNav')}
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onMobileClose}
          type="button"
        />
      ) : null}

      <aside
        className="fixed inset-y-0 left-0 z-40 w-[var(--sidebar-width)] -translate-x-full border-r border-[var(--mantine-color-default-border)] bg-[var(--sidebar)] px-3 py-4 transition-transform duration-200 ease-out data-[opened=true]:translate-x-0 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0"
        data-opened={mobileOpened}
      >
        <SidebarContent navItems={navItems} onNavigate={onMobileClose} />
      </aside>
    </>
  )
}
