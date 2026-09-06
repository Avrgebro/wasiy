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
import { TintChip } from '../../components/ui/chips'
import { FilterButton } from '../../components/table/filter-button'
import { TableToolbar } from '../../components/table/table-toolbar'
import { QuickFilters } from '../../components/table/quick-filters'
import { SearchInput } from '../../components/table/search-input'
import { getErrorMessage } from '../../lib/errors'
import { useMe, usePhoneFormat } from '../auth/hooks'
import { getVisits, type VisitSummary } from './api'
import { RegisterVisitDrawer } from './register-visit-drawer'
import { VISIT_CHIPS, VISIT_CONFIRMATIONS, type VisitsSearchValues } from './schemas'
import { checkInLabel } from './visit-presentation'
import { VisitDrawer } from './visit-drawer'

const routeApi = getRouteApi('/_authenticated/admin/visitors')

export function VisitsPage() {
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
      <Alert color="warning" title={t('visits.title')}>
        {t('auth.selectLocationRequired')}
      </Alert>
    )
  }

  return <VisitsContent accountId={me.active_account.id} locationId={location.id} locationName={location.name} timezone={location.timezone} />
}

function VisitsContent({ accountId, locationId, locationName, timezone }: { accountId: string; locationId: string; locationName: string; timezone: string }) {
  const { t } = useTranslation('common')
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  const [registering, setRegistering] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const now = new Date()

  const listQuery = useQuery({
    queryKey: ['visits', locationId, search],
    queryFn: () =>
      getVisits(locationId, {
        page: search.page,
        search: search.search,
        confirmation: search.confirmation,
        status: search.chip === 'inside' ? 'inside' : undefined,
        today: search.chip === 'today' ? 1 : undefined,
        expected: search.chip === 'expected' ? 1 : undefined,
      }),
    placeholderData: keepContextData(['visits', locationId]),
  })
  const insideCount = useQuery({ queryKey: ['visits', locationId, 'inside-count'], queryFn: () => getVisits(locationId, { status: 'inside', per_page: 1 }) }).data?.meta.total
  const todayCount = useQuery({ queryKey: ['visits', locationId, 'today-count'], queryFn: () => getVisits(locationId, { today: 1, per_page: 1 }) }).data?.meta.total
  const expectedCount = useQuery({ queryKey: ['visits', locationId, 'expected-count'], queryFn: () => getVisits(locationId, { expected: 1, per_page: 1 }) }).data?.meta.total

  function updateSearch(next: Partial<VisitsSearchValues>) {
    void navigate({ search: (current) => ({ ...current, ...next, page: next.page ?? 1 }) })
  }

  const rows = listQuery.data?.data ?? []
  const selected = selectedId ? (rows.find((row) => row.id === selectedId) ?? null) : null
  const confirmationOptions = VISIT_CONFIRMATIONS.map((value) => ({ value, label: t(`visits.confirmations.${value}`) }))
  const filterChips = buildFilterChips([
    { key: 'confirmation', label: t('visits.columns.confirmation'), value: search.confirmation, options: confirmationOptions, onRemove: () => updateSearch({ confirmation: '' }) },
  ])

  const formatPhone = usePhoneFormat()
  const columns: ColumnDef<VisitSummary>[] = [
    {
      accessorKey: 'checked_in_at',
      header: t('visits.columns.checkIn'),
      meta: { className: 'whitespace-nowrap' },
      cell: ({ row }) => (
        <span className="font-mono text-xs text-[var(--wa-text-3)]">
          {row.original.status === 'expected' ? (row.original.expected_time ?? t('visits.expected.noTime')) : checkInLabel(row.original.checked_in_at, timezone, now)}
        </span>
      ),
    },
    {
      accessorKey: 'visitor_name',
      header: t('visits.columns.visitor'),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{row.original.visitor_name}</span>
          {row.original.document || row.original.phone ? (
            <span className="text-[11.5px] text-[var(--wa-text-3)]">{row.original.document ?? formatPhone(row.original.phone)}</span>
          ) : null}
        </div>
      ),
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
      id: 'host',
      header: t('visits.columns.host'),
      meta: { hideBelow: 'md' },
      cell: ({ row }) =>
        row.original.resident_name ? (
          <Text size="sm">{row.original.resident_name}</Text>
        ) : (
          <Text c="dimmed" size="sm">
            {t('visits.unitOnly', { unit: row.original.unit_number ?? '' })}
          </Text>
        ),
    },
    {
      accessorKey: 'confirmation',
      header: t('visits.columns.confirmation'),
      meta: { hideBelow: 'lg' },
      cell: ({ row }) => (
        <span className="whitespace-nowrap rounded-full border border-[var(--mantine-color-default-border)] px-2.5 py-[3px] text-[11.5px] font-medium text-[var(--mantine-color-dimmed)]">
          {t(`visits.confirmations.${row.original.confirmation}`)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('packages.columns.status'),
      cell: ({ row }) => (
        <TintChip color={row.original.status === 'inside' ? 'success' : row.original.status === 'expected' ? 'info' : 'gray'}>{t(`visits.statuses.${row.original.status}`)}</TintChip>
      ),
    },
    { id: 'open', header: '', meta: { className: 'w-6 text-right' }, cell: () => <span className="text-[15px] text-[var(--wa-text-3)]">›</span> },
  ]

  const chipCount = (key: (typeof VISIT_CHIPS)[number]) => (key === 'inside' ? insideCount : key === 'today' ? todayCount : key === 'expected' ? expectedCount : undefined)

  return (
    <div className="@container flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-bold text-[var(--mantine-color-text)]">{t('visits.title')}</h1>
          <Text c="dimmed" mt={6} size="sm">
            {t('visits.subtitle', { location: locationName, date: new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone }).format(now) })}
          </Text>
        </div>
        <Button className="w-full sm:w-auto" color="accent" leftSection={<AddIcon size={18} />} onClick={() => setRegistering(true)}>
          {t('visits.register')}
        </Button>
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
        selectedId={selectedId}
        toolbar={
          <TableToolbar
            appliedChips={filterChips}
            filters={
              <FilterButton activeCount={filterChips.length} onClearAll={() => updateSearch({ confirmation: '' })}>
                  <Select
                    clearable
                    comboboxProps={FILTER_COMBOBOX_PROPS}
                    data={confirmationOptions}
                    label={t('visits.columns.confirmation')}
                    placeholder={t('visits.allConfirmations')}
                    value={search.confirmation || null}
                    onChange={(value) => updateSearch({ confirmation: value ?? '' })}
                  />
              </FilterButton>
            }
            quickFilters={
              <QuickFilters
                label={t('table.quickFilters')}
                options={VISIT_CHIPS.map((key) => ({ key, label: t(`visits.chips.${key}`), count: chipCount(key) }))}
                value={search.chip}
                onChange={(chip) => updateSearch({ chip })}
              />
            }
            search={<SearchInput defaultValue={search.search} placeholder={t('visits.searchPlaceholder')} onApply={(value) => updateSearch({ search: value })} />}
            onClearAll={() => updateSearch({ confirmation: '' })}
          />
        }
        onPageChange={(page) => updateSearch({ page })}
        onRowClick={(visit) => setSelectedId(visit.id)}
      />

      <VisitDrawer timezone={timezone} visit={selected} onClose={() => setSelectedId(null)} />
      <RegisterVisitDrawer accountId={accountId} locationId={locationId} locationName={locationName} opened={registering} onClose={() => setRegistering(false)} />
    </div>
  )
}
