import { Button } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { BuildingsList } from './buildings-list'

/** The Torres button on Unidades opens the same list the location settings show. */
export function BuildingsDrawer({ locationId, locationName, onClose, opened }: { locationId: string; locationName: string; onClose: () => void; opened: boolean }) {
  const { t } = useTranslation('common')

  return (
    <AppDrawer opened={opened} subtitle={locationName} title={t('buildings.title')} onClose={onClose}>
      <AppDrawerBody>
        <BuildingsList locationId={locationId} />
      </AppDrawerBody>
      <AppDrawerFooter>
        <Button variant="default" onClick={onClose}>
          {t('actions.close')}
        </Button>
      </AppDrawerFooter>
    </AppDrawer>
  )
}
