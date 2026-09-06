import { PageAction } from '../../components/ui/page-action'
import { keepContextData } from '../../lib/keep-context-data'
import { Alert, Text } from '@mantine/core'
import { AddIcon } from '@solar-icons/react/linear'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '../../components/table/data-table'
import { TintChip } from '../../components/ui/chips'
import { SearchInput } from '../../components/table/search-input'
import { TableToolbar } from '../../components/table/table-toolbar'
import { QuickFilters } from '../../components/table/quick-filters'
import { getErrorMessage } from '../../lib/errors'
import { useMe } from '../auth/hooks'
import { shortDateTime } from '../finances/month'
import { getPackages, type PackageSummary } from './api'
import { PackageDrawer } from './package-drawer'
import { RegisterPackageDrawer } from './register-package-drawer'
import { PACKAGE_CHIPS, type PackagesSearchValues } from './schemas'

const routeApi = getRouteApi('/_authenticated/admin/packages')

export function PackagesPage() {
  const { t } = useTranslation('common')
  const me = useMe().data
  const location = me?.active_location

  if (!me || !me.active_account) {
    return (
      <Alert color="warning" title={t('auth.noAccessTitle')}>
        {t('accountSelection.title')}
      </Alert>
    )
  }

  if (!location) {
    return (
      <Alert color="warning" title={t('packages.title')}>
        {t('auth.selectLocationRequired')}
      </Alert>
    )
  }

  return <PackagesContent accountId={me.active_account.id} locationId={location.id} locationName={location.name} timezone={location.timezone} />
}

function PackagesContent({ accountId, locationId, locationName, timezone }: { accountId: string; locationId: string; locationName: string; timezone: string }) {
  const { t } = useTranslation('common')
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  const [registering, setRegistering] = useState(false)
  const [selected, setSelected] = useState<PackageSummary | null>(null)

  const listQuery = useQuery({
    queryKey: ['packages', locationId, search],
    queryFn: () =>
      getPackages(locationId, {
        page: search.page,
        search: search.search,
        status: search.chip === 'all' ? undefined : search.chip,
      }),
    placeholderData: keepContextData(['packages', locationId]),
  })
  // The En recepción count is the number the desk cares about; it is the
  // list's own total while that chip is active and unfiltered.
  const pendingCountQuery = useQuery({
    queryKey: ['packages', locationId, 'pending-count'],
    queryFn: () => getPackages(locationId, { status: 'pending', per_page: 1 }),
  })
  const pendingCount = pendingCountQuery.data?.meta.total

  function updateSearch(next: Partial<PackagesSearchValues>) {
    void navigate({ search: (current) => ({ ...current, ...next, page: next.page ?? 1 }) })
  }

  // Keep the drawer in sync with a refetched row (e.g. after delivery).
  const rows = listQuery.data?.data ?? []
  const current = selected ? (rows.find((row) => row.id === selected.id) ?? selected) : null

  const columns: ColumnDef<PackageSummary>[] = [
    {
      accessorKey: 'received_at',
      header: t('packages.columns.received'),
      meta: { className: 'whitespace-nowrap' },
      cell: ({ row }) => <span className="font-mono text-xs text-[var(--wa-text-3)]">{shortDateTime(row.original.received_at, timezone)}</span>,
    },
    {
      accessorKey: 'unit_number',
      header: t('packages.columns.unit'),
      meta: { className: 'whitespace-nowrap' },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-display text-sm font-semibold">{row.original.unit_number}</span>
          {row.original.building_name ? <span className="text-[11.5px] text-[var(--wa-text-3)]">{row.original.building_name}</span> : null}
        </div>
      ),
    },
    {
      id: 'for',
      header: t('packages.columns.for'),
      cell: ({ row }) =>
        row.original.resident_name ? (
          <Text size="sm">{row.original.resident_name}</Text>
        ) : (
          <Text c="dimmed" size="sm">
            {t('packages.primaryContact')}
          </Text>
        ),
    },
    {
      accessorKey: 'notes',
      header: t('registry.notes'),
      meta: { hideBelow: 'md', className: 'max-w-72' },
      cell: ({ row }) => (
        <Text c="dimmed" className="truncate" size="sm">
          {row.original.notes ?? '—'}
        </Text>
      ),
    },
    {
      accessorKey: 'status',
      header: t('packages.columns.status'),
      cell: ({ row }) => (
        <TintChip color={row.original.status === 'pending' ? 'warning' : 'success'}>{t(`packages.statuses.${row.original.status}`)}</TintChip>
      ),
    },
    { id: 'open', header: '', meta: { className: 'w-6 text-right' }, cell: () => <span className="text-[15px] text-[var(--wa-text-3)]">›</span> },
  ]

  return (
    <div className="@container flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-bold text-[var(--mantine-color-text)]">{t('packages.title')}</h1>
          <Text c="dimmed" mt={6} size="sm">
            {t('packages.subtitle', { location: locationName })}
          </Text>
        </div>
        <PageAction className="w-full sm:w-auto" color="accent" leftSection={<AddIcon size={18} />} onClick={() => setRegistering(true)}>
          {t('packages.register')}
        </PageAction>
      </div>

      {listQuery.isError ? (
        <Alert color="error" title={t('errors.loadFailed')}>
          {getErrorMessage(listQuery.error)}
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        fetching={listQuery.isPlaceholderData}
        loading={listQuery.isLoading}
        meta={listQuery.data?.meta}
        selectedId={current?.id ?? null}
        toolbar={
          <TableToolbar
            quickFilters={
              <QuickFilters
                label={t('table.quickFilters')}
                options={PACKAGE_CHIPS.map((key) => ({ key, label: t(`packages.chips.${key}`), count: key === 'pending' ? pendingCount : undefined }))}
                value={search.chip}
                onChange={(chip) => updateSearch({ chip })}
              />
            }
            search={<SearchInput defaultValue={search.search} placeholder={t('packages.searchPlaceholder')} onApply={(value) => updateSearch({ search: value })} />}
          />
        }
        onPageChange={(page) => updateSearch({ page })}
        onRowClick={setSelected}
      />

      <PackageDrawer pkg={current} timezone={timezone} onClose={() => setSelected(null)} />
      <RegisterPackageDrawer accountId={accountId} locationId={locationId} locationName={locationName} opened={registering} onClose={() => setRegistering(false)} />
    </div>
  )
}
