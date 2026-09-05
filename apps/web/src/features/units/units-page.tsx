import { Alert, Badge, Button, Text } from '@mantine/core'
import { AddCircle, Buildings } from '@solar-icons/react'
import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { DataTable } from '../../components/table/data-table'
import { getErrorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { can } from '../auth/access'
import { useMe } from '../auth/hooks'
import { ImportRegistryButton } from '../imports/import-registry-button'
import { getUnits, type UnitSummary } from './api'
import { chipParams, UNIT_CHIPS, type UnitsSearchValues } from './schemas'
import { occupancyColor, portalColor, unitDescriptor, unitLabelsLine } from './unit-presentation'
import { BuildingsDrawer } from '../buildings/buildings-drawer'
import { UnitFormDrawer } from './unit-form-drawer'
import { UnitsFilters } from './units-filters'

const routeApi = getRouteApi('/_authenticated/admin/registry/units')

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

  return <UnitsContent canManage={can(me, 'registry.manage')} canManageBuildings={can(me, 'location.settings')} locationId={location.id} locationName={location.name} />
}

function UnitsContent({ canManage, canManageBuildings, locationId, locationName }: { canManage: boolean; canManageBuildings: boolean; locationId: string; locationName: string }) {
  const { t } = useTranslation('common')
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  const [creating, setCreating] = useState(false)
  const [managingBuildings, setManagingBuildings] = useState(false)

  const listQuery = useQuery({
    queryKey: ['registry', 'units', locationId, search],
    queryFn: () =>
      getUnits(locationId, {
        page: search.page,
        search: search.search,
        sort: search.sort,
        type: search.type,
        status: search.status,
        ...chipParams(search.chip),
      }),
    placeholderData: keepPreviousData,
  })

  function updateSearch(next: Partial<UnitsSearchValues>) {
    void navigate({ search: (current) => ({ ...current, ...next, page: next.page ?? 1 }) })
  }

  const rows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total
  const isFiltered = Boolean(search.chip || search.search || search.type || search.status)

  const columns: ColumnDef<UnitSummary>[] = [
    {
      accessorKey: 'unit_number',
      header: t('units.columns.unit'),
      meta: { sortKey: 'unit_number', className: 'whitespace-nowrap' },
      cell: ({ row }) => {
        const labels = unitLabelsLine(row.original)

        return (
          <div className="flex flex-col">
            <span className="font-display text-sm font-semibold">{row.original.unit_number}</span>
            {labels ? <span className="text-[11.5px] text-[var(--wa-text-3)]">{labels}</span> : null}
          </div>
        )
      },
    },
    {
      id: 'descriptor',
      header: t('units.columns.floorType'),
      meta: { hideBelow: 'md', className: 'whitespace-nowrap' },
      cell: ({ row }) => (
        <Text c="dimmed" size="sm">
          {unitDescriptor(row.original, t)}
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
      id: 'portal',
      header: t('units.columns.portal'),
      meta: { hideBelow: 'lg' },
      cell: ({ row }) =>
        row.original.portal_state ? (
          <Badge color={portalColor(row.original.portal_state)} radius="xl" size="sm" variant="light">
            {t(`units.portal.${row.original.portal_state}`)}
          </Badge>
        ) : (
          <Text c="dimmed" size="sm">
            —
          </Text>
        ),
    },
    {
      id: 'occupancy',
      header: t('units.columns.status'),
      cell: ({ row }) => (
        <Badge color={occupancyColor(row.original.occupancy)} radius="xl" size="sm" variant="light">
          {t(`units.occupancy.${row.original.occupancy}`)}
        </Badge>
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
            {canManageBuildings ? (
              <Button className="w-full sm:w-auto" leftSection={<Buildings size={18} />} variant="default" onClick={() => setManagingBuildings(true)}>
                {t('buildings.title')}
              </Button>
            ) : null}
            <ImportRegistryButton />
            <Button className="w-full sm:w-auto" color="accent" leftSection={<AddCircle size={18} />} onClick={() => setCreating(true)}>
              {t('units.form.createTitle')}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 pointer-coarse:gap-3">
        <ChipButton
          active={search.chip === undefined}
          label={total !== undefined && !isFiltered ? `${t('units.chips.all')} · ${total}` : t('units.chips.all')}
          onClick={() => updateSearch({ chip: undefined })}
        />
        {UNIT_CHIPS.map((key) => (
          <ChipButton
            key={key}
            active={search.chip === key}
            label={t(`units.chips.${key}`)}
            onClick={() => updateSearch({ chip: key })}
          />
        ))}
      </div>

      {listQuery.isError ? (
        <Alert color="error" title={t('errors.loadFailed')}>
          {getErrorMessage(listQuery.error)}
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        emptyState={
          <div className="grid min-h-40 place-items-center px-6 text-center">
            <div>
              <Text fw={600}>{t(isFiltered ? 'units.emptyFilteredTitle' : 'units.emptyTitle', { location: locationName })}</Text>
              <Text c="dimmed" mt={4} size="sm">
                {t(isFiltered ? 'units.emptyFilteredBody' : 'units.emptyBody')}
              </Text>
            </div>
          </div>
        }
        fetching={listQuery.isPlaceholderData}
        groupBy={(unit) => unit.building_name}
        loading={listQuery.isLoading}
        meta={listQuery.data?.meta}
        sort={search.sort}
        toolbar={<UnitsFilters search={search} onChange={updateSearch} />}
        onPageChange={(page) => updateSearch({ page })}
        onRowClick={(unit) =>
          void navigate({ to: '/admin/registry/units/$unitId', params: { unitId: unit.id } })
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
      <BuildingsDrawer locationId={locationId} locationName={locationName} opened={managingBuildings} onClose={() => setManagingBuildings(false)} />
    </div>
  )
}

function ChipButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={`cursor-pointer rounded-full border px-[15px] py-[7px] text-xs font-semibold transition-colors pointer-coarse:min-h-11 pointer-coarse:px-5 ${
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

  if (!unit.primary_contact) {
    return (
      <Text c="warning" size="sm">
        — {t('units.noPrimaryContact')}
      </Text>
    )
  }

  const initials = unit.primary_contact.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  const others = unit.resident_count - 1

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--wa-secondary)] text-[11px] font-semibold text-[#F7F5F0]">
        {initials}
      </span>
      <Text className="min-w-0 truncate" size="sm">
        {unit.primary_contact.name}
        {others > 0 ? <span className="text-[var(--mantine-color-dimmed)]"> +{others}</span> : null}
      </Text>
    </div>
  )
}
