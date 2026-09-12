import { FILTER_COMBOBOX_PROPS } from '../../components/table/filter-combobox-props'
import { MultiSelect, Select } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { FilterButton } from '../../components/table/filter-button'
import { TableToolbar } from '../../components/table/table-toolbar'
import { SearchInput } from '../../components/table/search-input'
import { QuickFilters } from '../../components/table/quick-filters'
import { EXPENSE_CATEGORIES, FINANCE_CHIPS, INCOME_CATEGORIES, type FinancesSearchValues } from './schemas'

/**
 * Toolbar: the quick views (Todo, Ingresos, Egresos, Pendientes · N), text
 * search over concept, detail and vendor, and Estado plus the category
 * multi-select behind Filtros; applied filters echoed as chips.
 */
export function FinancesFilters({
  onChange,
  pendingCount,
  search,
}: {
  onChange: (next: Partial<FinancesSearchValues>) => void
  pendingCount: number
  search: FinancesSearchValues
}) {
  const { t } = useTranslation('common')
  const quickOptions = [
    { key: 'all' as const, label: t('finances.chips.all') },
    ...FINANCE_CHIPS.map((key) => ({ key, label: t(`finances.chips.${key}`), count: key === 'pending' && pendingCount > 0 ? pendingCount : undefined })),
  ]
  const statusOptions = (['pending', 'payable', 'paid', 'held', 'refunded', 'retained', 'voided'] as const).map((value) => ({ value, label: t(`finances.statuses.${value}`) }))
  const selected = search.category ? search.category.split(',').filter(Boolean) : []
  const label = (value: string) => t(`finances.categories.${value}`)

  const groups = [
    { group: t('finances.form.income'), items: INCOME_CATEGORIES.map((value) => ({ value, label: label(value) })) },
    { group: t('finances.form.expense'), items: EXPENSE_CATEGORIES.map((value) => ({ value, label: label(value) })) },
  ]

  const chips = [
    ...(search.status
      ? [{ key: 'status', label: `${t('finances.columns.status')}: ${t(`finances.statuses.${search.status}`)}`, onRemove: () => onChange({ status: '' }) }]
      : []),
    ...selected.map((value) => ({
      key: `category:${value}`,
      label: `${t('finances.columns.category')}: ${label(value)}`,
      onRemove: () => onChange({ category: selected.filter((other) => other !== value).join(',') }),
    })),
  ]

  return (
    <TableToolbar
      appliedChips={chips}
      filters={
        <FilterButton activeCount={chips.length} onClearAll={() => onChange({ category: '', status: '' })}>
            <Select
              clearable
              comboboxProps={FILTER_COMBOBOX_PROPS}
              data={statusOptions}
              label={t('finances.columns.status')}
              placeholder={t('finances.allStatuses')}
              value={search.status || null}
              onChange={(value) => onChange({ status: value ?? '' })}
            />
            <MultiSelect
              clearable
              comboboxProps={FILTER_COMBOBOX_PROPS}
              data={groups}
              label={t('finances.columns.category')}
              placeholder={selected.length === 0 ? t('finances.allCategories') : undefined}
              searchable
              value={selected}
              onChange={(values) => onChange({ category: values.join(',') })}
            />
        </FilterButton>
      }
      quickFilters={<QuickFilters label={t('table.quickFilters')} options={quickOptions} value={search.chip ?? 'all'} onChange={(key) => onChange({ chip: key === 'all' ? undefined : key })} />}
      search={<SearchInput defaultValue={search.search} placeholder={t('finances.searchPlaceholder')} onApply={(value) => onChange({ search: value })} />}
      onClearAll={() => onChange({ category: '', status: '' })}
    />
  )
}
