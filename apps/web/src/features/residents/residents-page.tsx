import { Alert, Badge, Button, Select, Text } from '@mantine/core'
import { AddCircle } from '@solar-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildFilterChips } from '../../components/table/build-filter-chips'
import { DataTable } from '../../components/table/data-table'
import { FilterButton } from '../../components/table/filter-button'
import { FilterChips } from '../../components/table/filter-chips'
import { SearchInput } from '../../components/table/search-input'
import { getErrorMessage } from '../../lib/errors'
import { telHref } from '../../lib/phone'
import { can } from '../auth/access'
import { useMe, usePhoneFormat } from '../auth/hooks'
import { portalColor } from '../units/unit-presentation'
import { getResidents, type ResidentSummary } from './api'
import { PersonDrawer } from './person-drawer'
import { PersonFormDrawer } from './person-form-drawer'
import { RESIDENT_CHIPS, type ResidentsSearchValues } from './schemas'

const routeApi = getRouteApi('/_authenticated/admin/registry/residents')

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

  const chip = search.chip
  const listQuery = useQuery({
    queryKey: ['registry', 'residents', locationId, search],
    queryFn: () =>
      getResidents(accountId, {
        location_id: locationId,
        page: search.page,
        search: search.search,
        portal: search.portal,
        status: search.status,
        no_unit: chip === 'no_unit' ? 1 : undefined,
      }),
    placeholderData: keepPreviousData,
  })

  function updateSearch(next: Partial<ResidentsSearchValues>) {
    void navigate({ search: (current) => ({ ...current, ...next, page: next.page ?? 1 }) })
  }

  const rows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total
  const isFiltered = Boolean(chip || search.search || search.portal || search.status)

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
      id: 'portal',
      header: t('units.columns.portal'),
      meta: { hideBelow: 'md' },
      cell: ({ row }) => (
        <Badge color={portalColor(row.original.portal_state)} radius="xl" size="sm" variant="light">
          {t(`units.portal.${row.original.portal_state}`)}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: t('registry.status'),
      meta: { hideBelow: 'lg' },
      cell: ({ row }) => (
        <Badge color={row.original.status === 'active' ? 'success' : 'gray'} radius="xl" size="sm" variant="light">
          {t(`registry.statuses.${row.original.status}`)}
        </Badge>
      ),
    },
    { id: 'open', header: '', meta: { className: 'w-6 text-right' }, cell: () => <span className="text-[15px] text-[var(--wa-text-3)]">›</span> },
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
          <Button className="w-full sm:w-auto" color="accent" leftSection={<AddCircle size={18} />} onClick={() => setForm({ open: true, editing: null })}>
            {t('residents.form.createTitle')}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 pointer-coarse:gap-3">
        <ChipButton
          active={chip === undefined}
          label={total !== undefined && !isFiltered ? `${t('residents.chips.all')} · ${total}` : t('residents.chips.all')}
          onClick={() => updateSearch({ chip: undefined })}
        />
        {RESIDENT_CHIPS.map((key) => (
          <ChipButton key={key} active={chip === key} label={t(`residents.chips.${key}`)} onClick={() => updateSearch({ chip: key })} />
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
            <Text c="dimmed" size="sm">
              {t(isFiltered ? 'residents.emptyFiltered' : 'residents.empty', { location: locationName })}
            </Text>
          </div>
        }
        fetching={listQuery.isPlaceholderData}
        loading={listQuery.isLoading}
        meta={listQuery.data?.meta}
        rowClassName={(person) => (person.status === 'inactive' ? 'opacity-60' : undefined)}
        selectedId={selectedId}
        toolbar={
          <div className="flex flex-wrap items-center gap-2.5 p-3.5 sm:px-5">
            <SearchInput defaultValue={search.search} placeholder={t('residents.searchPlaceholder')} onApply={(value) => updateSearch({ search: value })} />
            <FilterButton activeCount={filterChips.length}>
              <Select
                clearable
                comboboxProps={{ withinPortal: false }}
                data={portalOptions}
                label={t('units.columns.portal')}
                placeholder={t('residents.allPortalStates')}
                value={search.portal || null}
                onChange={(value) => updateSearch({ portal: value ?? '' })}
              />
              <Select
                clearable
                comboboxProps={{ withinPortal: false }}
                data={statusOptions}
                label={t('registry.status')}
                placeholder={t('residents.allStatuses')}
                value={search.status || null}
                onChange={(value) => updateSearch({ status: value ?? '' })}
              />
            </FilterButton>
            <FilterChips chips={filterChips} onClearAll={() => updateSearch({ portal: '', status: '' })} />
          </div>
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
