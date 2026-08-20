import { Select, TextInput } from '@mantine/core'
import { Magnifier } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'
import { FilterButton } from '../../components/table/filter-button'
import { FilterChips, type FilterChip } from '../../components/table/filter-chips'
import { accountRoles, getRoleLabelKey, locationRoles } from '../auth/access'
import type { StaffSearchValues } from './schemas'

export type LocationOption = { value: string; label: string }

function roleFilterOptions(t: (key: string) => string) {
  return [
    { label: t(getRoleLabelKey(accountRoles.accountAdmin)), value: accountRoles.accountAdmin },
    {
      label: t(getRoleLabelKey(locationRoles.locationManager)),
      value: locationRoles.locationManager,
    },
    { label: t(getRoleLabelKey(locationRoles.frontDesk)), value: locationRoles.frontDesk },
  ]
}

/**
 * Toolbar: always-visible text search, the configured filters behind the
 * Filtros popover, and the applied ones echoed as dismissable chips. Chips
 * and inputs are both projections of the same URL search params.
 */
export function StaffFilters({
  locations,
  onChange,
  search,
}: {
  locations: LocationOption[]
  onChange: (next: Partial<StaffSearchValues>) => void
  search: StaffSearchValues
}) {
  const { t } = useTranslation('common')
  const roleOptions = roleFilterOptions(t)
  const statusOptions = [
    { label: t('staff.statuses.active'), value: 'active' },
    { label: t('staff.statuses.deactivated'), value: 'deactivated' },
  ]

  const chips: FilterChip[] = []
  if (search.role) {
    const label = roleOptions.find((option) => option.value === search.role)?.label ?? search.role
    chips.push({
      key: 'role',
      label: `${t('staff.role')}: ${label}`,
      onRemove: () => onChange({ role: '' }),
    })
  }
  if (search.location_id) {
    const label =
      locations.find((option) => option.value === search.location_id)?.label ?? search.location_id
    chips.push({
      key: 'location_id',
      label: `${t('staff.location')}: ${label}`,
      onRemove: () => onChange({ location_id: '' }),
    })
  }
  if (search.status) {
    const label =
      statusOptions.find((option) => option.value === search.status)?.label ?? search.status
    chips.push({
      key: 'status',
      label: `${t('registry.status')}: ${label}`,
      onRemove: () => onChange({ status: '' }),
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 p-3.5 sm:px-5">
      <TextInput
        aria-label={t('actions.search')}
        className="w-full sm:w-64 lg:w-80"
        defaultValue={search.search}
        leftSection={<Magnifier size={15} />}
        placeholder={t('staff.searchPlaceholder')}
        onBlur={(event) => onChange({ search: event.currentTarget.value })}
      />
      <FilterButton activeCount={chips.length}>
        <Select
          clearable
          comboboxProps={{ withinPortal: false }}
          data={roleOptions}
          label={t('staff.role')}
          placeholder={t('staff.allRoles')}
          value={search.role || null}
          onChange={(value) => onChange({ role: value ?? '' })}
        />
        <Select
          clearable
          comboboxProps={{ withinPortal: false }}
          data={locations}
          label={t('staff.location')}
          placeholder={t('staff.allLocations')}
          value={search.location_id || null}
          onChange={(value) => onChange({ location_id: value ?? '' })}
        />
        <Select
          clearable
          comboboxProps={{ withinPortal: false }}
          data={statusOptions}
          label={t('registry.status')}
          placeholder={t('staff.allStatuses')}
          value={search.status || null}
          onChange={(value) => onChange({ status: value ?? '' })}
        />
      </FilterButton>
      <FilterChips
        chips={chips}
        onClearAll={() => onChange({ role: '', location_id: '', status: '' })}
      />
    </div>
  )
}
