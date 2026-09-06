import { FILTER_COMBOBOX_PROPS } from '../../components/table/filter-combobox-props'
import { Select } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { FilterButton } from '../../components/table/filter-button'
import { buildFilterChips } from '../../components/table/build-filter-chips'
import { TableToolbar } from '../../components/table/table-toolbar'
import { SearchInput } from '../../components/table/search-input'
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

  const chips = buildFilterChips([
    {
      key: 'role',
      label: t('staff.role'),
      value: search.role,
      options: roleOptions,
      onRemove: () => onChange({ role: '' }),
    },
    {
      key: 'location_id',
      label: t('staff.location'),
      value: search.location_id,
      options: locations,
      onRemove: () => onChange({ location_id: '' }),
    },
    {
      key: 'status',
      label: t('registry.status'),
      value: search.status,
      options: statusOptions,
      onRemove: () => onChange({ status: '' }),
    },
  ])

  return (
    <TableToolbar
      appliedChips={chips}
      filters={
        <FilterButton activeCount={chips.length} onClearAll={() => onChange({ role: '', location_id: '', status: '' })}>
          <Select
            clearable
            comboboxProps={FILTER_COMBOBOX_PROPS}
            data={roleOptions}
            label={t('staff.role')}
            placeholder={t('staff.allRoles')}
            value={search.role || null}
            onChange={(value) => onChange({ role: value ?? '' })}
          />
          <Select
            clearable
            comboboxProps={FILTER_COMBOBOX_PROPS}
            data={locations}
            label={t('staff.location')}
            placeholder={t('staff.allLocations')}
            value={search.location_id || null}
            onChange={(value) => onChange({ location_id: value ?? '' })}
          />
          <Select
            clearable
            comboboxProps={FILTER_COMBOBOX_PROPS}
            data={statusOptions}
            label={t('registry.status')}
            placeholder={t('staff.allStatuses')}
            value={search.status || null}
            onChange={(value) => onChange({ status: value ?? '' })}
          />
        </FilterButton>
      }
      search={<SearchInput defaultValue={search.search} placeholder={t('staff.searchPlaceholder')} onApply={(value) => onChange({ search: value })} />}
      onClearAll={() => onChange({ role: '', location_id: '', status: '' })}
    />
  )
}
