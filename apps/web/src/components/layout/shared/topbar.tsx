import { Badge, Button } from '@mantine/core'
import { Bell, HamburgerMenu, Logout } from '@solar-icons/react'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useLogout, useMe } from '../../../features/auth/hooks'
import { ColorSchemeToggle } from './color-scheme-toggle'
import { LocationSwitcher } from './location-switcher'

type TopbarProps = {
  onMobileNavOpen: () => void
  roleLabelKey?: string
  showLocationSwitcher?: boolean
  showNotifications?: boolean
  titleKey: string
}

export function Topbar({
  onMobileNavOpen,
  roleLabelKey,
  showLocationSwitcher = true,
  showNotifications = true,
  titleKey,
}: TopbarProps) {
  const { t } = useTranslation('common')
  const router = useRouter()
  const meQuery = useMe()
  const logoutMutation = useLogout()
  const accountName = meQuery.data?.active_account?.name ?? t('shell.account')

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => void router.navigate({ to: '/login' }),
    })
  }

  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 backdrop-blur lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          aria-label={t('shell.openNav')}
          className="shrink-0"
          hiddenFrom="lg"
          onClick={onMobileNavOpen}
          variant="subtle"
        >
          <HamburgerMenu size={18} />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--muted-foreground)]">
            {accountName}
          </p>
          <h1 className="truncate text-xl font-bold leading-7 text-[var(--foreground)]">
            {t(titleKey)}
          </h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ColorSchemeToggle />
        {showNotifications ? (
          <Button
            aria-label={t('notifications.label')}
            className="shrink-0"
            variant="subtle"
          >
            <Bell size={18} />
          </Button>
        ) : null}
        {showLocationSwitcher ? <LocationSwitcher /> : null}
        {roleLabelKey ? (
          <Badge color="wasiy" variant="light">
            {t(roleLabelKey)}
          </Badge>
        ) : null}
        <Button
          aria-label={t('auth.logout')}
          loading={logoutMutation.isPending}
          onClick={handleLogout}
          variant="subtle"
        >
          <Logout size={18} />
        </Button>
      </div>
    </header>
  )
}
