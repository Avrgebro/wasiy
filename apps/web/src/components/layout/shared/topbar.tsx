import { ActionIcon, Tooltip } from '@mantine/core'
import { Bell, HamburgerMenu, Magnifer } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'
import { UserMenu } from './user-menu'

type TopbarProps = {
  onMobileNavOpen: () => void
  showNotifications?: boolean
}

export function Topbar({
  onMobileNavOpen,
  showNotifications = true,
}: TopbarProps) {
  const { t } = useTranslation('common')

  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between bg-[var(--app-canvas)]/85 px-4 backdrop-blur lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ActionIcon
          aria-label={t('shell.openNav')}
          hiddenFrom="lg"
          onClick={onMobileNavOpen}
          size="lg"
          variant="subtle"
        >
          <HamburgerMenu size={18} />
        </ActionIcon>

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
              size="lg"
              variant="subtle"
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
