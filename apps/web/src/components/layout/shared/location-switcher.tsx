import { Button, Menu } from '@mantine/core'
import { AltArrowDown } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'

export function LocationSwitcher() {
  const { t } = useTranslation('common')

  return (
    <Menu position="bottom-end" width={220}>
      <Menu.Target>
        <Button rightSection={<AltArrowDown size={16} />} variant="default">
          {t('shell.location')}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t('shell.locations')}</Menu.Label>
        <Menu.Item>{t('shell.location')}</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
