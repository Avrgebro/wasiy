import {
  CheckIcon,
  Combobox,
  Group,
  InputBase,
  Text,
  useCombobox,
} from '@mantine/core'
import { Buildings } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'
import { getDefaultLocation } from '../../../features/auth/access'
import { useMe, useSelectLocation } from '../../../features/auth/hooks'
import type { LocationSummary } from '../../../features/auth/types'

function LocationOption({ location }: { location: LocationSummary }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Buildings aria-hidden="true" className="shrink-0" size={20} />
      <div className="min-w-0">
        <Text fw={500} size="sm" truncate>
          {location.name}
        </Text>
        <Text c="dimmed" size="xs" truncate>
          {location.address ?? location.timezone}
        </Text>
      </div>
    </Group>
  )
}

export function LocationSwitcher() {
  const { t } = useTranslation('common')
  const meQuery = useMe()
  const selectLocationMutation = useSelectLocation()
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  })
  const location = meQuery.data ? getDefaultLocation(meQuery.data) : null
  const accessibleLocations = meQuery.data?.accessible_locations ?? []

  if (accessibleLocations.length === 0) {
    return null
  }

  // The API auto-selects an active location during session sync whenever
  // any is accessible, so this fallback only covers the transient frame
  // before that sync lands — it is display-only, never a selection.
  const currentLocation = location ?? accessibleLocations[0]
  const hasMultipleLocations = accessibleLocations.length > 1

  if (!hasMultipleLocations) {
    return (
      <InputBase component="div" multiline>
        <LocationOption location={currentLocation} />
      </InputBase>
    )
  }

  function handleSelectLocation(locationId: string) {
    if (locationId !== location?.id) {
      selectLocationMutation.mutate(locationId)
    }
    combobox.closeDropdown()
  }

  return (
    <Combobox
      onOptionSubmit={handleSelectLocation}
      position="bottom-start"
      store={combobox}
      width="target"
    >
      <Combobox.Target>
        <InputBase
          aria-label={t('shell.selectLocation')}
          component="button"
          disabled={selectLocationMutation.isPending}
          multiline
          onClick={() => combobox.toggleDropdown()}
          pointer
          rightSection={<Combobox.Chevron />}
          rightSectionPointerEvents="none"
          type="button"
        >
          <LocationOption location={currentLocation} />
        </InputBase>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          <Combobox.Header>{t('shell.locations')}</Combobox.Header>
          {accessibleLocations.map((availableLocation) => (
            <Combobox.Option
              key={availableLocation.id}
              value={availableLocation.id}
            >
              <Group gap="xs" justify="space-between" wrap="nowrap">
                <LocationOption location={availableLocation} />
                {availableLocation.id === location?.id ? (
                  <CheckIcon size={12} />
                ) : null}
              </Group>
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}
