import { Select } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { FilterButton } from '../../components/table/filter-button'
import { buildFilterChips } from '../../components/table/build-filter-chips'
import { FilterChips } from '../../components/table/filter-chips'
import { SearchInput } from '../../components/table/search-input'
import { locationTypeValues } from './schemas'
import type { LocationsSearchValues } from './schemas'

/**
 * Toolbar: always-visible text search, status and type behind the Filtros
 * popover, applied filters echoed as dismissable chips. Chips and inputs
 * are both projections of the same URL search params.
 */
export function LocationFilters({
  onChange,
  search,
}: {
  onChange: (next: Partial<LocationsSearchValues>) => void
  search: LocationsSearchValues
}) {
  const { t } = useTranslation('common')
  const statusOptions = [
    { label: t('locations.statuses.active'), value: 'active' },
    { label: t('locations.statuses.deactivated'), value: 'deactivated' },
  ]
  const typeOptions = locationTypeValues.map((value) => ({
    label: t(`locations.types.${value}`),
    value,
  }))

  const chips = buildFilterChips([
    {
      key: 'status',
      label: t('registry.status'),
      value: search.status,
      options: statusOptions,
      onRemove: () => onChange({ status: '' }),
    },
    {
      key: 'type',
      label: t('locations.type'),
      value: search.type,
      options: typeOptions,
      onRemove: () => onChange({ type: '' }),
    },
  ])

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SearchInput
        defaultValue={search.search}
        placeholder={t('locations.searchPlaceholder')}
        onApply={(value) => onChange({ search: value })}
      />
      <FilterButton activeCount={chips.length}>
        <Select
          clearable
          comboboxProps={{ withinPortal: false }}
          data={statusOptions}
          label={t('registry.status')}
          placeholder={t('locations.allStatuses')}
          value={search.status || null}
          onChange={(value) => onChange({ status: value ?? '' })}
        />
        <Select
          clearable
          comboboxProps={{ withinPortal: false }}
          data={typeOptions}
          label={t('locations.type')}
          placeholder={t('locations.allTypes')}
          value={search.type || null}
          onChange={(value) => onChange({ type: value ?? '' })}
        />
      </FilterButton>
      <FilterChips chips={chips} onClearAll={() => onChange({ status: '', type: '' })} />
    </div>
  )
}
