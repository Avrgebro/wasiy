import { Select } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { buildFilterChips } from '../../components/table/build-filter-chips'
import { FilterButton } from '../../components/table/filter-button'
import { FilterChips } from '../../components/table/filter-chips'
import { SearchInput } from '../../components/table/search-input'
import type { UnitsSearchValues } from './schemas'

const TYPES = ['apartment', 'house', 'commercial', 'office'] as const

/**
 * Toolbar: one search box that reaches unit, building, residents and plates
 * (the vehicles page is gone), and Tipo / Estado behind Filtros. Occupancy,
 * portal and fee stay on the chip row above and are not repeated here.
 */
export function UnitsFilters({
  onChange,
  search,
}: {
  onChange: (next: Partial<UnitsSearchValues>) => void
  search: UnitsSearchValues
}) {
  const { t } = useTranslation('common')
  const typeOptions = TYPES.map((value) => ({ value, label: t(`units.types.${value}`) }))
  const statusOptions = [
    { value: 'active', label: t('units.statuses.active') },
    { value: 'inactive', label: t('units.statuses.inactive') },
  ]

  const chips = buildFilterChips([
    { key: 'type', label: t('units.columns.type'), value: search.type, options: typeOptions, onRemove: () => onChange({ type: '' }) },
    { key: 'status', label: t('registry.status'), value: search.status, options: statusOptions, onRemove: () => onChange({ status: '' }) },
  ])

  return (
    <div className="flex flex-wrap items-center gap-2.5 p-3.5 sm:px-5">
      <SearchInput
        defaultValue={search.search}
        placeholder={t('units.searchPlaceholder')}
        onApply={(value) => onChange({ search: value })}
      />
      <FilterButton activeCount={chips.length}>
        <Select
          clearable
          comboboxProps={{ withinPortal: false }}
          data={typeOptions}
          label={t('units.columns.type')}
          placeholder={t('units.allTypes')}
          value={search.type || null}
          onChange={(value) => onChange({ type: value ?? '' })}
        />
        <Select
          clearable
          comboboxProps={{ withinPortal: false }}
          data={statusOptions}
          label={t('registry.status')}
          placeholder={t('units.statuses.active')}
          value={search.status || null}
          onChange={(value) => onChange({ status: value ?? '' })}
        />
      </FilterButton>
      <FilterChips chips={chips} onClearAll={() => onChange({ type: '', status: '' })} />
    </div>
  )
}
