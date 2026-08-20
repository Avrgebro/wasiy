import { Button } from '@mantine/core'
import { CloseCircle } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'

export type FilterChip = {
  key: string
  /** Human-readable "Dimension: value" text; pages own the value mapping. */
  label: string
  onRemove: () => void
}

/**
 * Applied filters rendered as dismissable pills in the table toolbar. Chips
 * are a pure projection of the page's URL search params — removing one
 * clears that param, so bookmarks and back/forward stay coherent.
 */
export function FilterChips({
  chips,
  onClearAll,
}: {
  chips: FilterChip[]
  onClearAll: () => void
}) {
  const { t } = useTranslation('common')

  if (chips.length === 0) {
    return null
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default-hover)] py-1 pl-2.5 pr-1.5 text-xs font-medium text-[var(--mantine-color-text)]"
        >
          {chip.label}
          <button
            aria-label={t('table.removeFilter', { filter: chip.label })}
            className="grid cursor-pointer place-items-center border-0 bg-transparent p-0 text-[var(--mantine-color-dimmed)] hover:text-[var(--mantine-color-text)]"
            type="button"
            onClick={chip.onRemove}
          >
            <CloseCircle size={14} />
          </button>
        </span>
      ))}
      {chips.length > 1 ? (
        <Button size="compact-xs" variant="subtle" onClick={onClearAll}>
          {t('table.clearFilters')}
        </Button>
      ) : null}
    </div>
  )
}
