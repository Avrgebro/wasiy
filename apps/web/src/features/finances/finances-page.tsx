import { PageAction } from '../../components/ui/page-action'
import { MonthNavigation } from './month-navigation'
import { keepContextData } from '../../lib/keep-context-data'
import { Alert, Skeleton, Text } from '@mantine/core'
import { AddIcon, ArrowDownIcon, InfoCircleIcon } from '@solar-icons/react/linear'
import type { TFunction } from 'i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '../../components/table/data-table'
import { openRowColumn } from '../../components/table/open-row-column'
import { StatusPill } from '../../components/ui/chips'
import { StatCard } from '../../components/ui/stat-card'
import { getErrorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { useMe } from '../auth/hooks'
import { ConfirmDialog } from '../../components/ui/detail-drawer-parts'
import { notifyError, notifySuccess } from '../../lib/notify'
import { generateDues, getFinanceSummary, getMovements, type CategoryTotal, type FinanceSummary, type MovementSummary } from './api'
import { currentMonth, monthLabel, shortDate } from './month'
import { FinancesFilters } from './finances-filters'
import { MovementDrawer } from './movement-drawer'
import { MovementFormDrawer } from './movement-form-drawer'
import { amountClassName, statusColor, statusLabel } from './movement-presentation'
import { chipParams, type FinancesSearchValues } from './schemas'

const routeApi = getRouteApi('/_authenticated/admin/finances')

export function FinancesPage() {
  const { t } = useTranslation('common')
  const meQuery = useMe()
  const me = meQuery.data
  const account = me?.active_account
  const location = me?.active_location

  if (!me || !account) {
    return (
      <Alert color="warning" title={t('auth.noAccessTitle')}>
        {t('accountSelection.title')}
      </Alert>
    )
  }

  if (!location) {
    return (
      <Alert color="warning" title={t('finances.title')}>
        {t('finances.noLocation')}
      </Alert>
    )
  }

  return (
    <FinancesContent
      accountId={account.id}
      locationId={location.id}
      locationName={location.name}
      timezone={location.timezone}
    />
  )
}

function FinancesContent({
  accountId,
  locationId,
  locationName,
  timezone,
}: {
  accountId: string
  locationId: string
  locationName: string
  timezone: string
}) {
  const { t } = useTranslation('common')
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  // A row click selects locally; the URL param (deep link from a booking)
  // seeds it. Closing clears both so the link does not reopen the drawer.
  const [localSelected, setLocalSelected] = useState<string | null>(null)
  const selectedId = localSelected ?? search.movement ?? null
  const setSelectedId = (id: string | null) => {
    setLocalSelected(id)
    if (id === null && search.movement) {
      void navigate({ search: (current) => ({ ...current, movement: undefined }) })
    }
  }
  const [drawerOpened, setDrawerOpened] = useState(false)
  const [confirmingDues, setConfirmingDues] = useState(false)
  const queryClient = useQueryClient()

  const thisMonth = currentMonth(timezone)
  const month = search.month ?? thisMonth
  const chip = search.chip

  const summaryQuery = useQuery({
    queryKey: ['finances', 'summary', accountId, locationId, month],
    queryFn: () => getFinanceSummary(accountId, locationId, month),
    placeholderData: keepContextData(['finances', 'summary', accountId, locationId]),
  })
  const listQuery = useQuery({
    queryKey: ['finances', 'movements', accountId, locationId, month, chip ?? 'all', search.search, search.category, search.status, search.sort, search.page],
    queryFn: () =>
      getMovements(accountId, locationId, {
        month,
        page: search.page,
        search: search.search,
        sort: search.sort,
        ...chipParams(chip),
        // Explicit Filtros win over the quick view they overlap.
        ...(search.category ? { category: search.category } : {}),
        ...(search.status ? { status: search.status } : {}),
      }),
    placeholderData: keepContextData(['finances', 'movements', accountId, locationId]),
  })

  const dues = useMutation({
    mutationFn: () => generateDues(accountId, locationId, month),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ['finances'] })
      setConfirmingDues(false)
      notifySuccess(t('finances.dues.done', { created: data.created, skipped: data.skipped }))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  function updateSearch(next: Partial<FinancesSearchValues>) {
    void navigate({ search: (current) => ({ ...current, ...next, page: next.page ?? 1 }) })
  }

  const summary = summaryQuery.data?.data
  const pendingCount = summary ? summary.receivable_count + summary.payable_count : 0

  const columns: ColumnDef<MovementSummary>[] = [
    {
      accessorKey: 'occurred_on',
      header: t('finances.columns.date'),
      meta: { className: 'w-24 whitespace-nowrap', sortKey: 'occurred_on' },
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium text-[var(--wa-text-3)]">
          {shortDate(row.original.occurred_on)}
        </span>
      ),
    },
    {
      accessorKey: 'concept',
      header: t('finances.columns.concept'),
      cell: ({ row }) => (
        <div className="flex min-w-0 max-w-80 flex-col">
          <span className="flex min-w-0 items-center gap-2 font-semibold">
            {row.original.direction === 'expense' ? (
              <span className="grid size-4 shrink-0 place-items-center rounded-[5px] bg-[var(--mantine-color-error-light)] text-[var(--wa-error)]">
                <ArrowDownIcon size={10} />
              </span>
            ) : null}
            <span className="truncate">{row.original.concept}</span>
          </span>
          {row.original.detail ? (
            <span className="truncate text-xs text-[var(--wa-text-3)]">{row.original.detail}</span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: t('finances.columns.category'),
      meta: { hideBelow: 'lg' },
      cell: ({ row }) => (
        <span className="whitespace-nowrap rounded-full border border-[var(--mantine-color-default-border)] px-2.5 py-[3px] text-[11.5px] font-medium text-[var(--mantine-color-dimmed)]">
          {t(`finances.categories.${row.original.category}`)}
        </span>
      ),
    },
    {
      id: 'unit',
      header: t('finances.columns.unit'),
      meta: { hideBelow: 'md' },
      cell: ({ row }) => (
        <Text c="dimmed" size="sm">
          {row.original.unit_number ?? row.original.counterparty ?? '—'}
        </Text>
      ),
    },
    {
      accessorKey: 'amount',
      header: t('finances.columns.amount'),
      meta: { className: 'whitespace-nowrap', sortKey: 'amount' },
      cell: ({ row }) => (
        <span className={`font-mono text-sm font-semibold ${amountClassName(row.original)}`}>
          {formatMoney(row.original.amount, { negative: row.original.direction === 'expense' })}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('finances.columns.status'),
      meta: { sortKey: 'status' },
      cell: ({ row }) => (
        <StatusPill color={statusColor(row.original.status)}>{statusLabel(row.original, t)}</StatusPill>
      ),
    },
    openRowColumn(),
  ]

  return (
    <div className="@container flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-bold text-[var(--mantine-color-text)]">{t('finances.title')}</h1>
          <Text c="dimmed" mt={6} size="sm">
            {t('finances.subtitle', { location: locationName, month: monthLabel(month) })}
          </Text>
        </div>
        <div className="flex w-full flex-wrap gap-2.5 sm:w-auto">
          <PageAction className="w-full sm:w-auto" variant="default" onClick={() => setConfirmingDues(true)}>
            {t('finances.dues.action')}
          </PageAction>
          <PageAction
            className="w-full sm:w-auto"
            color="accent"
            leftSection={<AddIcon size={18} />}
            onClick={() => setDrawerOpened(true)}
          >
            {t('finances.record')}
          </PageAction>
        </div>
      </div>
      <ConfirmDialog
        body={t('finances.dues.confirmBody', { month: monthLabel(month) })}
        opened={confirmingDues}
        title={t('finances.dues.confirmTitle', { month: monthLabel(month) })}
        onCancel={() => setConfirmingDues(false)}
        onConfirm={() => dues.mutate()}
      />

      <div className="flex items-center gap-2.5 rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] px-4 py-3">
        <InfoCircleIcon className="shrink-0 text-[var(--wa-interactive)]" size={16} />
        <Text c="dimmed" size="sm">
          {t('finances.disclaimer')}
        </Text>
      </div>

      {summaryQuery.isError ? (
        <Alert color="error" title={t('errors.loadFailed')}>
          {getErrorMessage(summaryQuery.error)}
        </Alert>
      ) : summary ? (
        <div className={summaryQuery.isPlaceholderData ? 'opacity-60' : undefined}>
          <SummaryTiles summary={summary} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 @4xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} height={112} radius="lg" />
          ))}
        </div>
      )}

      <MonthNavigation month={month} thisMonth={thisMonth} onChange={(value) => updateSearch({ month: value })} />

      {listQuery.isError ? (
        <Alert color="error" title={t('errors.loadFailed')}>
          {getErrorMessage(listQuery.error)}
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        data={listQuery.data?.data ?? []}
        fetching={listQuery.isPlaceholderData}
        loading={listQuery.isLoading}
        meta={listQuery.data?.meta}
        selectedId={selectedId}
        sort={search.sort}
        toolbar={<FinancesFilters pendingCount={pendingCount} search={search} onChange={updateSearch} />}
        onPageChange={(page) => updateSearch({ page })}
        onRowClick={(movement) => setSelectedId(movement.id)}
        onSortChange={(sort) => updateSearch({ sort })}
      />

      <MovementDrawer
        accountId={accountId}
        movementId={selectedId}
        timezone={timezone}
        onClose={() => setSelectedId(null)}
      />
      <MovementFormDrawer
        accountId={accountId}
        locationId={locationId}
        opened={drawerOpened}
        timezone={timezone}
        onClose={() => setDrawerOpened(false)}
      />
    </div>
  )
}


/** Sublines are statistics only: breakdowns and comparisons, never claims. */
function byCategoryLine(rows: CategoryTotal[], t: TFunction, withAmount: boolean, limit = 3): string {
  if (rows.length === 0) {
    return t('finances.tiles.none')
  }

  return rows
    .slice(0, limit)
    .map((row) =>
      withAmount
        ? `${t(`finances.categories.${row.category}`)} ${formatMoney(row.total)}`
        : `${row.count} ${t(`finances.categoriesPlural.${row.category}`, { count: row.count })}`,
    )
    .join(' · ')
}

function SummaryTiles({ summary }: { summary: FinanceSummary }) {
  const { t } = useTranslation('common')
  const delta = summary.balance - summary.previous_balance

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 @4xl:grid-cols-4">
      <StatCard
        detail={byCategoryLine(summary.income_by_category, t, false)}
        label={t('finances.tiles.income')}
        tone="success"
        value={formatMoney(summary.income_total)}
      />
      <StatCard
        detail={byCategoryLine(summary.expense_by_category, t, true)}
        label={t('finances.tiles.expense')}
        tone="error"
        value={formatMoney(summary.expense_total, { negative: summary.expense_total > 0 })}
      />
      <StatCard
        detail={t('finances.tiles.balanceVsPrevious', {
          month: monthLabel(summary.previous_month).split(' ')[0],
          delta: `${delta > 0 ? '+ ' : ''}${formatMoney(delta)}`,
        })}
        label={t('finances.tiles.balance')}
        value={formatMoney(summary.balance)}
      />
      <StatCard
        aside={t('finances.tiles.heldAside', { amount: formatMoney(summary.deposits_held_total) })}
        detail={t('finances.tiles.receivableDetail', {
          pending: summary.receivable_count,
          refunds: summary.deposits_to_refund_count,
        })}
        highlighted={summary.receivable_count + summary.deposits_to_refund_count > 0}
        label={t('finances.tiles.receivable')}
        tone="accent"
        value={formatMoney(summary.receivable_total)}
      />
    </div>
  )
}
