import { PageAction } from '../../components/ui/page-action'
import { keepContextData } from '../../lib/keep-context-data'
import { FILTER_COMBOBOX_PROPS } from '../../components/table/filter-combobox-props'
import { Alert, Button, Select, Text } from '@mantine/core'
import { AddIcon } from '@solar-icons/react/linear'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildFilterChips } from '../../components/table/build-filter-chips'
import { DataTable } from '../../components/table/data-table'
import { openRowColumn } from '../../components/table/open-row-column'
import { TintChip } from '../../components/ui/chips'
import { FilterButton } from '../../components/table/filter-button'
import { TableToolbar } from '../../components/table/table-toolbar'
import { SearchInput } from '../../components/table/search-input'
import { getErrorMessage } from '../../lib/errors'
import { telHref } from '../../lib/phone'
import { can } from '../auth/access'
import { useMe, usePhoneFormat } from '../auth/hooks'
import { getResidents, type ResidentSummary } from './api'
import { PersonDrawer } from './person-drawer'
import { PersonFormDrawer } from './person-form-drawer'
import type { ResidentsSearchValues } from './schemas'

const routeApi = getRouteApi('/_authenticated/admin/residents')

export function ResidentsPage() {
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
      <Alert color="warning" title={t('registry.residents.title')}>
        {t('auth.selectLocationRequired')}
      </Alert>
    )
  }

  return (
    <ResidentsContent
      accountId={me.active_account.id}
      canManage={can(me, 'registry.manage')}
      locationId={location.id}
      locationName={location.name}
      timezone={location.timezone}
    />
  )
}

function ResidentsContent({
  accountId,
  canManage,
  locationId,
  locationName,
  timezone,
}: {
  accountId: string
  canManage: boolean
  locationId: string
  locationName: string
  timezone: string
}) {
  const { t } = useTranslation('common')
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; editing: ResidentSummary | null }>({ open: false, editing: null })

  const listQuery = useQuery({
    queryKey: ['registry', 'residents', locationId, search],
    queryFn: () =>
      getResidents(accountId, {
        location_id: locationId,
        page: search.page,
        search: search.search,
        portal: search.portal,
        status: search.status,
      }),
    placeholderData: keepContextData(['registry', 'residents', locationId]),
  })

  function updateSearch(next: Partial<ResidentsSearchValues>) {
    void navigate({ search: (current) => ({ ...current, ...next, page: next.page ?? 1 }) })
  }

  const rows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total

  const portalOptions = (['active', 'invited', 'not_invited'] as const).map((value) => ({ value, label: t(`units.portal.${value}`) }))
  const statusOptions = [
    { value: 'active', label: t('registry.statuses.active') },
    { value: 'inactive', label: t('registry.statuses.inactive') },
  ]
  const filterChips = buildFilterChips([
    { key: 'portal', label: t('units.columns.portal'), value: search.portal, options: portalOptions, onRemove: () => updateSearch({ portal: '' }) },
    { key: 'status', label: t('registry.status'), value: search.status, options: statusOptions, onRemove: () => updateSearch({ status: '' }) },
  ])

  const formatPhone = usePhoneFormat()
  const columns: ColumnDef<ResidentSummary>[] = [
    {
      accessorKey: 'name',
      header: t('residents.columns.person'),
      cell: ({ row }) => <PersonCell person={row.original} />,
    },
    {
      accessorKey: 'phone',
      header: t('registry.residents.phone'),
      meta: { className: 'whitespace-nowrap' },
      cell: ({ row }) =>
        row.original.phone ? (
          // Tap to call on phones; a plain link elsewhere.
          <a
            className="font-mono text-[13px] text-[var(--wa-interactive)] no-underline hover:underline"
            href={telHref(row.original.phone)}
            onClick={(event) => event.stopPropagation()}
          >
            {formatPhone(row.original.phone)}
          </a>
        ) : (
          <Text c="dimmed" size="sm">
            —
          </Text>
        ),
    },
    {
      id: 'units',
      header: t('units.title'),
      cell: ({ row }) => <UnitsCell locationId={locationId} person={row.original} />,
    },
    {
      accessorKey: 'status',
      header: t('registry.status'),
      meta: { hideBelow: 'lg' },
      cell: ({ row }) => (
        <TintChip color={row.original.status === 'active' ? 'success' : 'gray'}>{t(`registry.statuses.${row.original.status}`)}</TintChip>
      ),
    },
    openRowColumn(),
  ]

  return (
    <div className="@container flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-bold text-[var(--mantine-color-text)]">{t('registry.residents.title')}</h1>
          <Text c="dimmed" mt={6} size="sm">
            {total !== undefined ? t('residents.subtitle', { count: total, location: locationName }) : locationName}
          </Text>
        </div>
        {canManage ? (
          <PageAction className="w-full sm:w-auto" color="accent" leftSection={<AddIcon size={18} />} onClick={() => setForm({ open: true, editing: null })}>
            {t('residents.form.createTitle')}
          </PageAction>
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
        emptyActions={search.search && !search.status ? (
          <Button size="compact-sm" variant="subtle" onClick={() => updateSearch({ status: 'inactive' })}>
            {t('residents.searchInactive')}
          </Button>
        ) : undefined}
        fetching={listQuery.isPlaceholderData}
        loading={listQuery.isLoading}
        meta={listQuery.data?.meta}
        rowClassName={(person) => (person.status === 'inactive' ? 'opacity-60' : undefined)}
        selectedId={selectedId}
        toolbar={
          <TableToolbar
            appliedChips={filterChips}
            filters={
              <FilterButton activeCount={filterChips.length} onClearAll={() => updateSearch({ portal: '', status: '' })}>
                <Select
                  clearable
                  comboboxProps={FILTER_COMBOBOX_PROPS}
                  data={portalOptions}
                  label={t('units.columns.portal')}
                  placeholder={t('residents.allPortalStates')}
                  value={search.portal || null}
                  onChange={(value) => updateSearch({ portal: value ?? '' })}
                />
                <Select
                  clearable
                  comboboxProps={FILTER_COMBOBOX_PROPS}
                  data={statusOptions}
                  label={t('registry.status')}
                  placeholder={t('registry.statuses.active')}
                  value={search.status || null}
                  onChange={(value) => updateSearch({ status: value ?? '' })}
                />
              </FilterButton>
            }
            search={<SearchInput defaultValue={search.search} placeholder={t('residents.searchPlaceholder')} onApply={(value) => updateSearch({ search: value })} />}
            onClearAll={() => updateSearch({ portal: '', status: '' })}
          />
        }
        onPageChange={(page) => updateSearch({ page })}
        onRowClick={(person) => setSelectedId(person.id)}
      />

      <PersonDrawer
        canManage={canManage}
        locationId={locationId}
        residentId={selectedId}
        timezone={timezone}
        onClose={() => setSelectedId(null)}
        onEdit={(person) => setForm({ open: true, editing: person })}
      />
      <PersonFormDrawer
        accountId={accountId}
        editing={form.editing}
        locationId={locationId}
        locationName={locationName}
        opened={form.open}
        onClose={() => setForm((current) => ({ ...current, open: false }))}
      />
    </div>
  )
}


function monogram(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function PersonCell({ person }: { person: ResidentSummary }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
          person.status === 'inactive' ? 'bg-[var(--wa-surface-2)] text-[var(--wa-text-3)]' : 'bg-[var(--wa-secondary)] text-[#F7F5F0]'
        }`}
      >
        {monogram(person.name)}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{person.name}</div>
        {/* Email exists in the payload only for managers; front desk never gets it. */}
        {person.email ? <div className="truncate text-xs text-[var(--wa-text-3)]">{person.email}</div> : null}
      </div>
    </div>
  )
}

/** Active memberships in this location as pills; a dot marks the primary contact. */
function UnitsCell({ locationId, person }: { locationId: string; person: ResidentSummary }) {
  const { t } = useTranslation('common')
  const active = person.memberships.filter((membership) => membership.location_id === locationId && membership.status === 'active')

  if (active.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        {t('residents.chips.no_unit')}
      </Text>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map((membership) => (
        <span
          key={membership.id}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--mantine-color-default-border)] px-2.5 py-[3px] text-[11.5px] font-medium text-[var(--mantine-color-dimmed)]"
          title={membership.is_primary_contact ? t('units.detail.primaryContact') : undefined}
        >
          {membership.is_primary_contact ? <span aria-hidden className="size-1.5 rounded-full bg-[var(--wa-accent)]" /> : null}
          <span className="font-semibold text-[var(--mantine-color-text)]">{membership.unit?.unit_number}</span>
          {membership.unit?.building_name}
        </span>
      ))}
    </div>
  )
}
