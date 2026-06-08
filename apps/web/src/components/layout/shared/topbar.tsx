import { Badge, Button } from '@mantine/core'
import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LocationSwitcher } from './location-switcher'

type TopbarProps = {
  accountKey: string
  roleLabelKey?: string
  showLocationSwitcher?: boolean
  showNotifications?: boolean
  titleKey: string
}

export function Topbar({
  accountKey,
  roleLabelKey,
  showLocationSwitcher = true,
  showNotifications = true,
  titleKey,
}: TopbarProps) {
  const { t } = useTranslation('common')

  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-[var(--border)] bg-white/90 px-4 backdrop-blur lg:px-6">
      <div>
        <p className="text-sm font-semibold text-[var(--muted-foreground)]">
          {t(accountKey)}
        </p>
        <h1 className="text-xl font-bold leading-7 text-[var(--foreground)]">
          {t(titleKey)}
        </h1>
      </div>
      <div className="flex items-center gap-2">
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
      </div>
    </header>
  )
}

