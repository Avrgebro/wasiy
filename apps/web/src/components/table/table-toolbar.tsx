import type { ReactNode } from 'react'
import { FilterChips, type FilterChip } from './filter-chips'

/**
 * The one toolbar grammar for every table (agreed 2026-09-05):
 *
 *   1. quick views      — only when the page has them; never wraps, scrolls
 *                          sideways on phones with a faded right edge
 *   2. search + Filtros — always present, always in this order; nothing else
 *                          ever joins this row
 *   3. applied filters  — only when a filter is set; wraps freely
 *
 * Anything that is not a filter (a month navigator, a page action) stays
 * out of the toolbar. Phones stack search and Filtros at full width; from
 * `sm` up they share a row and the search caps its own width.
 */
export function TableToolbar({
  appliedChips = [],
  filters,
  onClearAll,
  quickFilters,
  search,
}: {
  appliedChips?: FilterChip[]
  /** The FilterButton with its inputs. */
  filters?: ReactNode
  onClearAll?: () => void
  quickFilters?: ReactNode
  search: ReactNode
}) {
  return (
    <div className="flex flex-col">
      {quickFilters ? (
        <div className="border-b border-[var(--mantine-color-default-border)] px-3.5 py-3 max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] sm:px-5">
          {quickFilters}
        </div>
      ) : null}
      <div className="flex flex-col gap-2.5 p-3.5 sm:flex-row sm:items-center sm:px-5">
        {search}
        {filters ? <div className="[&_.mantine-Button-root]:w-full sm:[&_.mantine-Button-root]:w-auto">{filters}</div> : null}
      </div>
      {appliedChips.length > 0 && onClearAll ? (
        <div className="px-3.5 pb-3.5 sm:px-5">
          <FilterChips chips={appliedChips} onClearAll={onClearAll} />
        </div>
      ) : null}
    </div>
  )
}
