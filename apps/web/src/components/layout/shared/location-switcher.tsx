import { Button, Menu } from '@mantine/core'
import { AltArrowDown } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'
import { getDefaultLocation } from '../../../features/auth/access'
import { useMe, useSelectLocation } from '../../../features/auth/hooks'

export function LocationSwitcher() {
  const { t } = useTranslation('common')
  const meQuery = useMe()
  const selectLocationMutation = useSelectLocation()
  const location = meQuery.data ? getDefaultLocation(meQuery.data) : null
  const accessibleLocations = meQuery.data?.accessible_locations ?? []

  if (accessibleLocations.length === 0) {
    return null
  }

  if (accessibleLocations.length === 1) {
    return (
      <Button disabled variant="default">
        {location?.name ?? accessibleLocations[0]?.name ?? t('shell.location')}
      </Button>
    )
  }

  const locationName = location?.name ?? t('shell.selectLocation')

  async function handleSelectLocation(locationId: string) {
    await selectLocationMutation.mutateAsync(locationId)
  }

  return (
    <Menu position="bottom-end" width={220}>
      <Menu.Target>
        <Button
          loading={selectLocationMutation.isPending}
          rightSection={<AltArrowDown size={16} />}
          variant="default"
        >
          {locationName}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t('shell.locations')}</Menu.Label>
        {accessibleLocations.map((availableLocation) => (
          <Menu.Item
            disabled={
              selectLocationMutation.isPending ||
              availableLocation.id === location?.id
            }
            key={availableLocation.id}
            onClick={() => void handleSelectLocation(availableLocation.id)}
          >
            {availableLocation.name}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}
