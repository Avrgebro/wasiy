import { MultiSelect } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { FilterButton } from '../../components/table/filter-button'
import { FilterChips } from '../../components/table/filter-chips'
import { SearchInput } from '../../components/table/search-input'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type FinancesSearchValues } from './schemas'

/**
 * Toolbar: text search over concept, detail and vendor; the category
 * multi-select behind Filtros, grouped by direction and fed from the same
 * closed list as the pill column; applied categories echoed as chips.
 * Direction and status stay on the chip row above, never duplicated here.
 */
export function FinancesFilters({
  onChange,
  search,
}: {
  onChange: (next: Partial<FinancesSearchValues>) => void
  search: FinancesSearchValues
}) {
  const { t } = useTranslation('common')
  const selected = search.category ? search.category.split(',').filter(Boolean) : []
  const label = (value: string) => t(`finances.categories.${value}`)

  const groups = [
    { group: t('finances.form.income'), items: INCOME_CATEGORIES.map((value) => ({ value, label: label(value) })) },
    { group: t('finances.form.expense'), items: EXPENSE_CATEGORIES.map((value) => ({ value, label: label(value) })) },
  ]

  const chips = selected.map((value) => ({
    key: `category:${value}`,
    label: `${t('finances.columns.category')}: ${label(value)}`,
    onRemove: () => onChange({ category: selected.filter((other) => other !== value).join(',') }),
  }))

  return (
    <div className="flex flex-wrap items-center gap-2.5 p-3.5 sm:px-5">
      <SearchInput
        defaultValue={search.search}
        placeholder={t('finances.searchPlaceholder')}
        onApply={(value) => onChange({ search: value })}
      />
      <FilterButton activeCount={chips.length}>
        <MultiSelect
          clearable
          comboboxProps={{ withinPortal: false }}
          data={groups}
          label={t('finances.columns.category')}
          placeholder={selected.length === 0 ? t('finances.allCategories') : undefined}
          searchable
          value={selected}
          onChange={(values) => onChange({ category: values.join(',') })}
        />
      </FilterButton>
      <FilterChips chips={chips} onClearAll={() => onChange({ category: '' })} />
    </div>
  )
}
