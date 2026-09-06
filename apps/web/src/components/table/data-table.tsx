import { ActionIcon, Group, Loader, Table, Text } from '@mantine/core'
import { AltArrowDownIcon, AltArrowLeftIcon, AltArrowRightIcon, AltArrowUpIcon } from '@solar-icons/react/linear'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { nextSort, parseSort } from './sort'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Extra classes for both th and td of this column (widths, alignment). */
    className?: string
    /** Drop the column below this breakpoint; mobile cards cover phones. */
    hideBelow?: 'sm' | 'md' | 'lg'
    /** Server sort field this header toggles; omit for unsortable columns. */
    sortKey?: string
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
  groupBy,
  loading = false,
  meta,
  onPageChange,
  onRowClick,
  onSortChange,
  rowClassName,
  selectedId,
  sort,
  toolbar,
}: {
  columns: ColumnDef<TRow>[]
  data: TRow[]
  /** Shown when the list is empty after loading; omit to show bare headers. */
  emptyState?: ReactNode
  /** A page swap under keepPreviousData: rows stay visible but recede. */
  fetching?: boolean
  /** Inserts a band row whenever this key changes between consecutive rows (e.g. building). */
  groupBy?: (row: TRow) => string | null
  /** First load: nothing to show yet, render a centered loader. */
  loading?: boolean
  /** Laravel pagination meta; the footer pager renders only when present. */
  meta?: DataTablePaginationMeta
  onPageChange?: (page: number) => void
  /** Makes rows clickable (pointer, hover) and reports the clicked row. */
  onRowClick?: (row: TRow) => void
  /** Receives the next sort string when a sortable header is clicked. */
  onSortChange?: (sort: string) => void
  rowClassName?: (row: TRow) => string | undefined
  /** Current server sort string; drives the header indicators. */
  sort?: string
  /** Row rendered as selected (accent left bar) while a detail surface is open. */
  selectedId?: string | null
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
  const activeSort = parseSort(sort)

  return (
    <section className="overflow-hidden rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
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
                        {header.column.columnDef.meta?.sortKey && onSortChange ? (
                          <SortHeader
                            active={activeSort?.key === header.column.columnDef.meta.sortKey ? activeSort : null}
                            onClick={() =>
                              onSortChange(nextSort(sort, header.column.columnDef.meta!.sortKey!))
                            }
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </SortHeader>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Thead>
              <Table.Tbody>
                {table.getRowModel().rows.map((row, index, rows) => {
                  const group = groupBy?.(row.original) ?? null
                  const previous = index > 0 ? (groupBy?.(rows[index - 1].original) ?? null) : undefined
                  const band =
                    groupBy && group !== null && group !== previous ? (
                      <Table.Tr key={`group-${row.id}`} className="pointer-events-none">
                        <Table.Td
                          className="bg-[var(--wa-surface-2)] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--mantine-color-dimmed)]"
                          colSpan={row.getVisibleCells().length}
                        >
                          {group}
                        </Table.Td>
                      </Table.Tr>
                    ) : null

                  return [band, (
                  <Table.Tr
                    key={row.id}
                    aria-selected={selectedId === row.id || undefined}
                    className={[
                      rowClassName?.(row.original),
                      onRowClick ? 'cursor-pointer' : undefined,
                      selectedId === row.id
                        ? 'bg-[var(--mantine-color-default-hover)] shadow-[inset_2.5px_0_0_var(--wa-info)]'
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <Table.Td
                        key={cell.id}
                        className={columnClasses(cell.column.columnDef.meta)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                  )]
                })}
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
      <Text className="text-[var(--wa-text-3)]" size="sm">
        {t('table.showing', { from, to, total: meta.total })}
      </Text>
      <Group className="pointer-coarse:gap-3" gap={6}>
        <ActionIcon
          aria-label={t('table.previousPage')}
          disabled={meta.current_page <= 1}
          radius="md"
          size={32}
          variant="default"
          onClick={() => onPage(meta.current_page - 1)}
        >
          <AltArrowLeftIcon size={16} />
        </ActionIcon>
        <ActionIcon
          aria-label={t('table.nextPage')}
          disabled={meta.current_page >= meta.last_page}
          radius="md"
          size={32}
          variant="default"
          onClick={() => onPage(meta.current_page + 1)}
        >
          <AltArrowRightIcon size={16} />
        </ActionIcon>
      </Group>
    </Group>
  )
}

/**
 * A header that sorts: same typography as its siblings, an arrow only while
 * active so unsorted headers stay quiet.
 */
function SortHeader({
  active,
  children,
  onClick,
}: {
  active: { desc: boolean } | null
  children: ReactNode
  onClick: () => void
}) {
  const { t } = useTranslation('common')

  return (
    <button
      aria-label={t(active ? (active.desc ? 'table.sortedDesc' : 'table.sortedAsc') : 'table.sortBy')}
      aria-sort={active ? (active.desc ? 'descending' : 'ascending') : undefined}
      className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-inherit text-inherit uppercase tracking-wider hover:text-[var(--mantine-color-text)] pointer-coarse:min-h-11"
      type="button"
      onClick={onClick}
    >
      {children}
      {active ? active.desc ? <AltArrowDownIcon size={12} /> : <AltArrowUpIcon size={12} /> : null}
    </button>
  )
}
