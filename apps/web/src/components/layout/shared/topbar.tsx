import { ActionIcon, Input, Tooltip } from '@mantine/core'
import { BellIcon, HamburgerMenuIcon, MagnifierIcon } from '@solar-icons/react/linear'
import { spotlight } from '@mantine/spotlight'
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
        {/* Tailwind xl, not Mantine hiddenFrom: the sidebar this toggles is
            pinned open by Tailwind xl classes in app-shell and sidebar, and
            the two breakpoint scales disagree — keep them on one scale. */}
        <ActionIcon
          aria-label={t('shell.openNav')}
          className="xl:hidden"
          onClick={onMobileNavOpen}
          radius={10}
          size={40}
          variant="default"
        >
          <HamburgerMenuIcon size={18} />
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

        {/* Opens the ⌘K spotlight (features/search). Mantine's Input rendered
            as a button so it shares every input's colors, border, radius and
            height; the real field lives in the overlay. */}
        <Input
          className="hidden w-full max-w-md md:block"
          component="button"
          leftSection={<MagnifierIcon aria-hidden="true" size={15} />}
          pointer
          rightSection={
            <kbd className="rounded border border-[var(--mantine-color-default-border)] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[var(--mantine-color-dimmed)]">
              ⌘K
            </kbd>
          }
          rightSectionWidth={48}
          type="button"
          onClick={spotlight.open}
        >
          <Input.Placeholder>{t('shell.searchPlaceholder')}</Input.Placeholder>
        </Input>
        <ActionIcon
          aria-label={t('shell.searchPlaceholder')}
          className="md:hidden"
          color="gray"
          onClick={spotlight.open}
          radius={10}
          size={40}
          variant="subtle"
        >
          <MagnifierIcon size={18} />
        </ActionIcon>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showNotifications ? (
          <Tooltip label={t('notifications.label')}>
            <ActionIcon
              aria-label={t('notifications.label')}
              color="gray"
              radius={10}
              size={40}
              variant="subtle"
            >
              <BellIcon size={18} />
            </ActionIcon>
          </Tooltip>
        ) : null}
        <UserMenu />
      </div>
    </header>
  )
}
