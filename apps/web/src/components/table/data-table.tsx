import { ActionIcon, Group, Loader, Table, Text } from '@mantine/core'
import { AltArrowLeft, AltArrowRight } from '@solar-icons/react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Extra classes for both th and td of this column (widths, alignment). */
    className?: string
    /** Drop the column below this breakpoint; mobile cards cover phones. */
    hideBelow?: 'sm' | 'md' | 'lg'
  }
}

const hideBelowClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
}

export type DataTablePaginationMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

function columnClasses(meta: { className?: string; hideBelow?: 'sm' | 'md' | 'lg' } | undefined) {
  return [meta?.className, meta?.hideBelow ? hideBelowClasses[meta.hideBelow] : undefined]
    .filter(Boolean)
    .join(' ')
}

/**
 * The app's shared server-driven table: TanStack Table as the engine, our
 * design system as the skin. Owns the enclosing card (toolbar strip, header
 * band, footer pager); the page owns every data concern — queries, URL
 * state, filters content — and hands results in as props.
 */
export function DataTable<TRow extends { id: string }>({
  columns,
  data,
  emptyState,
  fetching = false,
  loading = false,
  meta,
  onPageChange,
  rowClassName,
  toolbar,
}: {
  columns: ColumnDef<TRow>[]
  data: TRow[]
  /** Shown when the list is empty after loading; omit to show bare headers. */
  emptyState?: ReactNode
  /** A page swap under keepPreviousData: rows stay visible but recede. */
  fetching?: boolean
  /** First load: nothing to show yet, render a centered loader. */
  loading?: boolean
  /** Laravel pagination meta; the footer pager renders only when present. */
  meta?: DataTablePaginationMeta
  onPageChange?: (page: number) => void
  rowClassName?: (row: TRow) => string | undefined
  /** Filter controls; the card header strip and border come from here. */
  toolbar?: ReactNode
}) {
  const { t } = useTranslation('common')
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    manualSorting: true,
  })

  const isEmpty = !loading && data.length === 0

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
      {toolbar ? (
        <div className="border-b border-[var(--mantine-color-default-border)]">{toolbar}</div>
      ) : null}
      {loading ? (
        <div className="grid min-h-64 place-items-center">
          <Loader aria-label={t('common.loading')} />
        </div>
      ) : isEmpty && emptyState ? (
        emptyState
      ) : (
        <div className={fetching ? 'opacity-60' : undefined}>
          {/* Narrow viewports scroll the table sideways; headers stay put. */}
          <div className="overflow-x-auto">
            <Table highlightOnHover horizontalSpacing="lg" verticalSpacing="sm">
              <Table.Thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <Table.Tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <Table.Th
                        key={header.id}
                        className={`text-xs uppercase tracking-wider ${columnClasses(header.column.columnDef.meta)}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Thead>
              <Table.Tbody>
                {table.getRowModel().rows.map((row) => (
                  <Table.Tr key={row.id} className={rowClassName?.(row.original)}>
                    {row.getVisibleCells().map((cell) => (
                      <Table.Td
                        key={cell.id}
                        className={columnClasses(cell.column.columnDef.meta)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        </div>
      )}
      {meta && onPageChange && !isEmpty ? (
        <DataTableFooter meta={meta} rowCount={data.length} onPage={onPageChange} />
      ) : null}
    </section>
  )
}

function DataTableFooter({
  meta,
  onPage,
  rowCount,
}: {
  meta: DataTablePaginationMeta
  onPage: (page: number) => void
  rowCount: number
}) {
  const { t } = useTranslation('common')
  const from = meta.total > 0 ? (meta.current_page - 1) * meta.per_page + 1 : 0
  const to = from + rowCount - 1

  return (
    <Group
      justify="space-between"
      className="flex-wrap gap-2 border-t border-[var(--mantine-color-default-border)] px-4 py-3 sm:px-5"
    >
      <Text c="dimmed" size="sm">
        {t('table.showing', { from, to, total: meta.total })}
      </Text>
      <Group gap={6}>
        <ActionIcon
          aria-label={t('table.previousPage')}
          disabled={meta.current_page <= 1}
          radius="md"
          size={32}
          variant="default"
          onClick={() => onPage(meta.current_page - 1)}
        >
          <AltArrowLeft size={16} />
        </ActionIcon>
        <ActionIcon
          aria-label={t('table.nextPage')}
          disabled={meta.current_page >= meta.last_page}
          radius="md"
          size={32}
          variant="default"
          onClick={() => onPage(meta.current_page + 1)}
        >
          <AltArrowRight size={16} />
        </ActionIcon>
      </Group>
    </Group>
  )
}
