import type { ColumnDef } from '@tanstack/react-table'

/**
 * The trailing chevron every clickable list table ends with: a narrow,
 * header-less column that tells the reader the whole row opens something.
 * Pair it with DataTable's onRowClick.
 */
export function openRowColumn<TRow>(): ColumnDef<TRow> {
  return {
    id: 'open',
    header: '',
    meta: { className: 'w-6 text-right' },
    cell: () => <span className="text-[15px] text-[var(--wa-text-3)]">›</span>,
  }
}
