import { keepContextData } from '../../lib/keep-context-data'
import { Alert, Avatar, Badge, Button, Text } from '@mantine/core'
import { AddIcon } from '@solar-icons/react/linear'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { DataTable } from '../../components/table/data-table'
import { getErrorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { can } from '../auth/access'
import { useMe } from '../auth/hooks'
import { getUnits, type UnitSummary } from './api'
import { attentionParams, type UnitsSearchValues } from './schemas'
import { UnitFormDrawer } from './unit-form-drawer'
import { UnitsFilters } from './units-filters'

const routeApi = getRouteApi('/_authenticated/admin/units')

export function UnitsPage() {
  const { t } = useTranslation('common')
  const meQuery = useMe()
  const me = meQuery.data
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
      <Alert color="warning" title={t('units.title')}>
        {t('auth.selectLocationRequired')}
      </Alert>
    )
  }

  return <UnitsContent canManage={can(me, 'registry.manage')} locationId={location.id} locationName={location.name} />
}

function UnitsContent({ canManage, locationId, locationName }: { canManage: boolean; locationId: string; locationName: string }) {
  const { t } = useTranslation('common')
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  const [creating, setCreating] = useState(false)

  const listQuery = useQuery({
    queryKey: ['registry', 'units', locationId, search],
    queryFn: () =>
      getUnits(locationId, {
        page: search.page,
        search: search.search,
        sort: search.sort,
        type: search.type,
        status: search.status,
        ...attentionParams(search.attention),
      }),
    placeholderData: keepContextData(['registry', 'units', locationId]),
  })

  function updateSearch(next: Partial<UnitsSearchValues>) {
    void navigate({ search: (current) => ({ ...current, ...next, page: next.page ?? 1 }) })
  }

  const rows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total

  const columns: ColumnDef<UnitSummary>[] = [
    {
      accessorKey: 'unit_number',
      header: t('units.columns.unit'),
      meta: { sortKey: 'unit_number', className: 'whitespace-nowrap' },
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold">{row.original.unit_number}</span>
          {row.original.status === 'inactive' ? (
            <Badge color="gray" radius="xl" size="xs" variant="light">
              {t('units.statuses.inactive')}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      accessorKey: 'floor',
      header: t('units.columns.floor'),
      meta: { hideBelow: 'md', sortKey: 'floor', className: 'whitespace-nowrap' },
      cell: ({ row }) => (
        <Text c="dimmed" size="sm">
          {row.original.floor ?? '—'}
        </Text>
      ),
    },
    {
      id: 'residents',
      header: t('units.columns.residents'),
      cell: ({ row }) => <ResidentsCell unit={row.original} />,
    },
    {
      accessorKey: 'vehicle_count',
      header: t('units.columns.vehicles'),
      meta: { hideBelow: 'lg', className: 'whitespace-nowrap' },
      cell: ({ row }) => (
        <Text c="dimmed" size="sm">
          {row.original.vehicle_count > 0 ? row.original.vehicle_count : '—'}
        </Text>
      ),
    },
    {
      accessorKey: 'maintenance_fee',
      header: t('units.columns.fee'),
      meta: { sortKey: 'maintenance_fee', className: 'whitespace-nowrap' },
      cell: ({ row }) => (
        <span className="font-mono text-[13px] font-semibold text-[var(--mantine-color-dimmed)]">
          {row.original.maintenance_fee !== null ? formatMoney(row.original.maintenance_fee) : '—'}
        </span>
      ),
    },
    {
      id: 'open',
      header: '',
      meta: { className: 'w-6 text-right' },
      cell: () => <span className="text-[15px] text-[var(--wa-text-3)]">›</span>,
    },
  ]

  return (
    <div className="@container flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-bold text-[var(--mantine-color-text)]">{t('units.title')}</h1>
          <Text c="dimmed" mt={6} size="sm">
            {total !== undefined
              ? t('units.subtitle', { count: total, location: locationName })
              : locationName}
          </Text>
        </div>
        {canManage ? (
          <div className="flex w-full flex-wrap gap-2.5 sm:w-auto">
            <Button className="w-full sm:w-auto" color="accent" leftSection={<AddIcon size={18} />} onClick={() => setCreating(true)}>
              {t('units.form.createTitle')}
            </Button>
          </div>
        ) : null}
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
        groupBy={(unit) => unit.building_name}
        loading={listQuery.isLoading}
        meta={listQuery.data?.meta}
        rowClassName={(unit) => (unit.status === 'inactive' ? 'opacity-60' : undefined)}
        sort={search.sort}
        toolbar={<UnitsFilters search={search} onChange={updateSearch} />}
        onPageChange={(page) => updateSearch({ page })}
        onRowClick={(unit) =>
          void navigate({ to: '/admin/units/$unitId', params: { unitId: unit.id } })
        }
        onSortChange={(sort) => updateSearch({ sort })}
      />

      <UnitFormDrawer
        editing={null}
        locationId={locationId}
        locationName={locationName}
        opened={creating}
        onClose={() => setCreating(false)}
      />
    </div>
  )
}


/** Primary contact plus a "+N" for the rest; the states the mockup calls out otherwise. */
function ResidentsCell({ unit }: { unit: UnitSummary }) {
  const { t } = useTranslation('common')

  if (unit.resident_count === 0) {
    return (
      <Text c="dimmed" size="sm">
        — {t('units.noResidents')}
      </Text>
    )
  }

  // The lead is the primary contact when there is one; a missing primary is
  // a data gap surfaced by the Atención filter, not by this cell.
  const lead = unit.lead_resident ?? ''
  const initials = lead
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  const others = unit.resident_count - 1

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar color="secondary" radius="xl" size={28}>
        {initials}
      </Avatar>
      <Text className="min-w-0 truncate" size="sm">
        {lead}
        {others > 0 ? <span className="text-[var(--mantine-color-dimmed)]"> +{others}</span> : null}
      </Text>
    </div>
  )
}
