import { ActionIcon, Tooltip } from '@mantine/core'
import { Bell, HamburgerMenu, Magnifer } from '@solar-icons/react'
import { useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useLocationContext } from '../../../features/auth/hooks'
import { findActiveNavItem } from './navigation-state'
import type { LayoutNavEntry } from './types'
import { UserMenu } from './user-menu'

type TopbarProps = {
  navItems: LayoutNavEntry[]
  onMobileNavOpen: () => void
  showNotifications?: boolean
}

export function Topbar({
  navItems,
  onMobileNavOpen,
  showNotifications = true,
}: TopbarProps) {
  const { t } = useTranslation('common')
  const { currentLocation } = useLocationContext()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const activeNavItem = findActiveNavItem(navItems, pathname)

  return (
    <header className="sticky top-0 z-10 flex min-h-[68px] items-center justify-between border-b border-[var(--mantine-color-default-border)] bg-[var(--topbar)]/95 px-4 backdrop-blur sm:min-h-16 sm:border-b-0 sm:bg-[var(--app-canvas)]/85 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Tailwind lg, not Mantine hiddenFrom="lg" (75em): the sidebar this
            toggles is pinned open by Tailwind lg classes in app-shell and
            sidebar, and the two scales disagree between 1024 and 1200px. */}
        <ActionIcon
          aria-label={t('shell.openNav')}
          className="lg:hidden"
          onClick={onMobileNavOpen}
          radius={10}
          size={40}
          variant="default"
        >
          <HamburgerMenu size={18} />
        </ActionIcon>

        {/* No fallback copy: an account can have zero locations and a route
            can be absent from the nav tree — render only real data. */}
        {currentLocation || activeNavItem ? (
          <div className="min-w-0 flex-1 md:hidden">
            {currentLocation ? (
              <p className="truncate text-[14px] font-semibold leading-tight text-[var(--mantine-color-text)]">
                {currentLocation.name}
              </p>
            ) : null}
            {activeNavItem ? (
              <p className="mt-1 truncate text-[11.5px] leading-tight text-[var(--mantine-color-dimmed)]">
                {t(activeNavItem.labelKey)}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* TEMPORARY: visual placeholder only — global search is not built yet.
            Remove or wire up when the search feature lands. */}
        <div className="hidden h-9 w-full max-w-md items-center gap-2 rounded-lg border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-body)] px-3 text-sm text-[var(--mantine-color-dimmed)] md:flex">
          <Magnifer aria-hidden="true" size={16} />
          <span>{t('shell.searchPlaceholder')}</span>
          <kbd className="ml-auto rounded border border-[var(--mantine-color-default-border)] px-1.5 py-0.5 font-sans text-[10px] font-semibold">
            ⌘K
          </kbd>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showNotifications ? (
          <Tooltip label={t('notifications.label')}>
            <ActionIcon
              aria-label={t('notifications.label')}
              radius={10}
              size={40}
              variant="default"
            >
              <Bell size={18} />
            </ActionIcon>
          </Tooltip>
        ) : null}
        <UserMenu />
      </div>
    </header>
  )
}
