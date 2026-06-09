import { Button, Menu } from '@mantine/core'
import { AltArrowDown } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'
import { getDefaultLocation } from '../../../features/auth/access'
import { useMe } from '../../../features/auth/hooks'

export function LocationSwitcher() {
  const { t } = useTranslation('common')
  const meQuery = useMe()
  const location = meQuery.data ? getDefaultLocation(meQuery.data) : null
  const locationName = location?.name ?? t('shell.location')

  return (
    <Menu position="bottom-end" width={220}>
      <Menu.Target>
        <Button rightSection={<AltArrowDown size={16} />} variant="default">
          {locationName}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t('shell.locations')}</Menu.Label>
        <Menu.Item>{locationName}</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
