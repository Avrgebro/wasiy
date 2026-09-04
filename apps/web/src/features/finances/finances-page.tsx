import { ActionIcon, Alert, Badge, Button, Group, Skeleton, Text } from '@mantine/core'
import { AddCircle, AltArrowLeft, AltArrowRight, ArrowDown, InfoCircle } from '@solar-icons/react'
import type { TFunction } from 'i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '../../components/table/data-table'
import { StatCard } from '../../components/ui/stat-card'
import { getErrorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { useMe } from '../auth/hooks'
import { getFinanceSummary, getMovements, type CategoryTotal, type FinanceSummary, type MovementSummary } from './api'
import { currentMonth, monthLabel, shiftMonth, shortDate } from './month'
import { FinancesFilters } from './finances-filters'
import { MovementDrawer } from './movement-drawer'
import { MovementFormDrawer } from './movement-form-drawer'
import { amountClassName, statusColor, statusLabel } from './movement-presentation'
import { chipParams, FINANCE_CHIPS, type FinancesSearchValues } from './schemas'

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

  const thisMonth = currentMonth(timezone)
  const month = search.month ?? thisMonth
  const chip = search.chip

  const summaryQuery = useQuery({
    queryKey: ['finances', 'summary', accountId, locationId, month],
    queryFn: () => getFinanceSummary(accountId, locationId, month),
    placeholderData: keepPreviousData,
  })
  const listQuery = useQuery({
    queryKey: ['finances', 'movements', accountId, locationId, month, chip ?? 'all', search.search, search.category, search.sort, search.page],
    queryFn: () =>
      getMovements(accountId, locationId, {
        month,
        page: search.page,
        search: search.search,
        sort: search.sort,
        ...chipParams(chip),
        // An explicit category filter wins over the Depósitos chip.
        ...(search.category ? { category: search.category } : {}),
      }),
    placeholderData: keepPreviousData,
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
        <span className="font-mono text-xs font-medium text-[var(--mantine-color-dimmed)]">
          {shortDate(row.original.occurred_on)}
        </span>
      ),
    },
    {
      accessorKey: 'concept',
      header: t('finances.columns.concept'),
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2 font-semibold">
            {row.original.direction === 'expense' ? (
              <span className="grid size-4 shrink-0 place-items-center rounded-[5px] bg-[var(--mantine-color-error-light)] text-[var(--wa-error)]">
                <ArrowDown size={10} />
              </span>
            ) : null}
            {row.original.concept}
          </span>
          {row.original.detail ? (
            <span className="text-xs text-[var(--mantine-color-dimmed)]">{row.original.detail}</span>
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
        <Badge color={statusColor(row.original.status)} radius="xl" size="sm" variant="light">
          {statusLabel(row.original, t)}
        </Badge>
      ),
    },
    {
      id: 'open',
      header: '',
      meta: { className: 'w-6 text-right' },
      cell: () => <span className="text-[15px] text-[var(--mantine-color-dimmed)]">›</span>,
    },
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
        <Button
          className="w-full sm:w-auto"
          color="accent"
          leftSection={<AddCircle size={18} />}
          size="sm"
          onClick={() => setDrawerOpened(true)}
        >
          {t('finances.record')}
        </Button>
      </div>

      <div className="flex items-center gap-2.5 rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] px-4 py-3">
        <InfoCircle className="shrink-0 text-[var(--wa-interactive)]" size={16} />
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

      <div className="flex flex-wrap items-center gap-2">
        <ChipButton active={chip === undefined} label={t('finances.chips.all')} onClick={() => updateSearch({ chip: undefined })} />
        {FINANCE_CHIPS.map((key) => (
          <ChipButton
            key={key}
            active={chip === key}
            label={
              key === 'pending' && pendingCount > 0
                ? `${t(`finances.chips.${key}`)} · ${pendingCount}`
                : t(`finances.chips.${key}`)
            }
            onClick={() => updateSearch({ chip: key })}
          />
        ))}
        <Group className="w-full sm:ml-auto sm:w-auto" gap={6} wrap="nowrap">
          <ActionIcon
            aria-label={t('finances.previousMonth')}
            radius="md"
            size="input-sm"
            variant="default"
            onClick={() => updateSearch({ month: shiftMonth(month, -1) })}
          >
            <AltArrowLeft size={16} />
          </ActionIcon>
          <Button
            className="min-w-36 capitalize"
            size="sm"
            variant="default"
            onClick={() => updateSearch({ month: undefined })}
          >
            {monthLabel(month)}
          </Button>
          <ActionIcon
            aria-label={t('finances.nextMonth')}
            disabled={month >= thisMonth}
            radius="md"
            size="input-sm"
            variant="default"
            onClick={() => updateSearch({ month: shiftMonth(month, 1) })}
          >
            <AltArrowRight size={16} />
          </ActionIcon>
        </Group>
      </div>

      {listQuery.isError ? (
        <Alert color="error" title={t('errors.loadFailed')}>
          {getErrorMessage(listQuery.error)}
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        data={listQuery.data?.data ?? []}
        emptyState={
          <div className="grid min-h-40 place-items-center px-6 text-center">
            <Text c="dimmed" size="sm">
              {t(chip || search.search || search.category ? 'finances.emptyFiltered' : 'finances.emptyMonth', { month: monthLabel(month) })}
            </Text>
          </div>
        }
        fetching={listQuery.isPlaceholderData}
        loading={listQuery.isLoading}
        meta={listQuery.data?.meta}
        selectedId={selectedId}
        sort={search.sort}
        toolbar={<FinancesFilters search={search} onChange={updateSearch} />}
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

function ChipButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={`cursor-pointer rounded-full border px-[15px] py-[7px] text-xs font-semibold transition-colors ${
        active
          ? 'border-[var(--wa-accent)] bg-[var(--wa-accent)] text-[#1c2b2c]'
          : 'border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] text-[var(--mantine-color-dimmed)]'
      }`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
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
