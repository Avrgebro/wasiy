import { Select, TextInput } from '@mantine/core'
import { Magnifier } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'
import { FilterButton } from '../../components/table/filter-button'
import { FilterChips, type FilterChip } from '../../components/table/filter-chips'
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

  const chips: FilterChip[] = []
  if (search.status) {
    const label =
      statusOptions.find((option) => option.value === search.status)?.label ?? search.status
    chips.push({
      key: 'status',
      label: `${t('registry.status')}: ${label}`,
      onRemove: () => onChange({ status: '' }),
    })
  }
  if (search.type) {
    const label = typeOptions.find((option) => option.value === search.type)?.label ?? search.type
    chips.push({
      key: 'type',
      label: `${t('locations.type')}: ${label}`,
      onRemove: () => onChange({ type: '' }),
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <TextInput
        aria-label={t('actions.search')}
        className="w-full sm:w-64 lg:w-80"
        defaultValue={search.search}
        leftSection={<Magnifier size={15} />}
        placeholder={t('locations.searchPlaceholder')}
        onBlur={(event) => onChange({ search: event.currentTarget.value })}
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
