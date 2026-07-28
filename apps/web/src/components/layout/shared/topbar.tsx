import { ActionIcon, Tooltip } from '@mantine/core'
import { Bell, HamburgerMenu } from '@solar-icons/react'
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
    <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] px-4 backdrop-blur lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <ActionIcon
          aria-label={t('shell.openNav')}
          hiddenFrom="lg"
          onClick={onMobileNavOpen}
          size="lg"
          variant="subtle"
        >
          <HamburgerMenu size={18} />
        </ActionIcon>
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
