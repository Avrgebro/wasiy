import { Select } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { buildFilterChips } from '../../components/table/build-filter-chips'
import { FilterButton } from '../../components/table/filter-button'
import { TableToolbar } from '../../components/table/table-toolbar'
import { SearchInput } from '../../components/table/search-input'
import { UNIT_ATTENTION, type UnitsSearchValues } from './schemas'

const TYPES = ['apartment', 'house', 'commercial', 'office'] as const

/**
 * Toolbar: one search box that reaches unit, building, residents and plates,
 * and Tipo / Estado / Atención behind Filtros. No quick-view row: the table
 * is a directory, not a queue.
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

  const attentionOptions = UNIT_ATTENTION.map((value) => ({ value, label: t(`units.attention.${value}`) }))

  const chips = buildFilterChips([
    { key: 'type', label: t('units.columns.type'), value: search.type, options: typeOptions, onRemove: () => onChange({ type: '' }) },
    { key: 'status', label: t('registry.status'), value: search.status, options: statusOptions, onRemove: () => onChange({ status: '' }) },
    { key: 'attention', label: t('units.attention.label'), value: search.attention ?? '', options: attentionOptions, onRemove: () => onChange({ attention: undefined }) },
  ])

  return (
    <TableToolbar
      appliedChips={chips}
      filters={
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
            <Select
              clearable
              comboboxProps={{ withinPortal: false }}
              data={attentionOptions}
              label={t('units.attention.label')}
              placeholder={t('units.attention.any')}
              value={search.attention ?? null}
              onChange={(value) => onChange({ attention: (value as UnitsSearchValues['attention']) ?? undefined })}
            />
        </FilterButton>
      }
      search={<SearchInput defaultValue={search.search} placeholder={t('units.searchPlaceholder')} onApply={(value) => onChange({ search: value })} />}
      onClearAll={() => onChange({ type: '', status: '', attention: undefined })}
    />
  )
}
