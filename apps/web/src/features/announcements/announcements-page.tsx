import { PageAction } from '../../components/ui/page-action'
import { keepContextData } from '../../lib/keep-context-data'
import { Alert, Badge, Text } from '@mantine/core'
import { AddIcon } from '@solar-icons/react/linear'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '../../components/table/data-table'
import { openRowColumn } from '../../components/table/open-row-column'
import { QuickFilters } from '../../components/table/quick-filters'
import { SearchInput } from '../../components/table/search-input'
import { TableToolbar } from '../../components/table/table-toolbar'
import { StatusPill } from '../../components/ui/chips'
import { getErrorMessage } from '../../lib/errors'
import { can } from '../auth/access'
import { useMe } from '../auth/hooks'
import { AnnouncementDrawer } from './announcement-drawer'
import { AnnouncementFormDrawer } from './announcement-form-drawer'
import { getAnnouncements, type AnnouncementSummary } from './api'
import { announcementStatusColor, publishedLabel, validityLabel } from './presentation'
import { ANNOUNCEMENT_CHIPS, type AnnouncementsSearchValues } from './schemas'

const routeApi = getRouteApi('/_authenticated/admin/announcements')

export function AnnouncementsPage() {
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
      <Alert color="warning" title={t('announcements.title')}>
        {t('auth.selectLocationRequired')}
      </Alert>
    )
  }

  return <AnnouncementsContent canManage={can(me, 'announcements.manage')} locationId={location.id} locationName={location.name} timezone={location.timezone} />
}

function AnnouncementsContent({ canManage, locationId, locationName, timezone }: { canManage: boolean; locationId: string; locationName: string; timezone: string }) {
  const { t } = useTranslation('common')
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; editing: AnnouncementSummary | null }>({ open: false, editing: null })

  const listQuery = useQuery({
    queryKey: ['announcements', locationId, search],
    queryFn: () => getAnnouncements(locationId, { page: search.page, search: search.search, status: search.chip === 'all' ? undefined : search.chip }),
    placeholderData: keepContextData(['announcements', locationId]),
  })
  const activeCount = useQuery({
    queryKey: ['announcements', locationId, 'active-count'],
    queryFn: () => getAnnouncements(locationId, { status: 'active', per_page: 1 }),
  }).data?.meta.total
  const scheduledCount = useQuery({
    queryKey: ['announcements', locationId, 'scheduled-count'],
    queryFn: () => getAnnouncements(locationId, { status: 'scheduled', per_page: 1 }),
  }).data?.meta.total

  function updateSearch(next: Partial<AnnouncementsSearchValues>) {
    void navigate({ search: (current) => ({ ...current, ...next, page: next.page ?? 1 }) })
  }

  const rows = listQuery.data?.data ?? []
  const selected = selectedId ? (rows.find((row) => row.id === selectedId) ?? null) : null

  const columns: ColumnDef<AnnouncementSummary>[] = [
    {
      accessorKey: 'title',
      header: t('announcements.columns.title'),
      meta: { className: 'max-w-96' },
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-2">
          {row.original.is_important ? (
            <Badge className="shrink-0" color="accent" radius="sm" size="xs" variant="light">
              {t('announcements.important')}
            </Badge>
          ) : null}
          <span className="truncate text-sm font-semibold">{row.original.title}</span>
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('announcements.columns.status'),
      cell: ({ row }) => <StatusPill color={announcementStatusColor(row.original.status)}>{t(`announcements.statuses.${row.original.status}`)}</StatusPill>,
    },
    {
      id: 'validity',
      header: t('announcements.columns.validity'),
      meta: { hideBelow: 'md' },
      cell: ({ row }) => (
        <Text c="dimmed" size="sm">
          {validityLabel(row.original, timezone, t)}
        </Text>
      ),
    },
    {
      id: 'published',
      header: t('announcements.columns.published'),
      meta: { hideBelow: 'lg' },
      cell: ({ row }) => (
        <Text c="dimmed" size="sm">
          {publishedLabel(row.original, timezone, t)}
        </Text>
      ),
    },
    {
      accessorKey: 'notified_count',
      header: t('announcements.columns.notified'),
      meta: { hideBelow: 'lg' },
      cell: ({ row }) => (
        <Text c="dimmed" className="tabular-nums" size="sm">
          {row.original.published_at ? row.original.notified_count : '—'}
        </Text>
      ),
    },
    openRowColumn(),
  ]

  return (
    <div className="@container flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-bold text-[var(--mantine-color-text)]">{t('announcements.title')}</h1>
          <Text c="dimmed" mt={6} size="sm">
            {activeCount !== undefined && scheduledCount !== undefined
              ? t('announcements.subtitle', { location: locationName, active: activeCount, scheduled: scheduledCount })
              : locationName}
          </Text>
        </div>
        {canManage ? (
          <PageAction className="w-full sm:w-auto" color="accent" leftSection={<AddIcon size={18} />} onClick={() => setForm({ open: true, editing: null })}>
            {t('announcements.create')}
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
        fetching={listQuery.isPlaceholderData}
        loading={listQuery.isLoading}
        meta={listQuery.data?.meta}
        rowClassName={(row) => (row.status === 'expired' || row.status === 'archived' ? 'opacity-60' : undefined)}
        selectedId={selectedId}
        toolbar={
          <TableToolbar
            quickFilters={
              <QuickFilters
                label={t('table.quickFilters')}
                options={ANNOUNCEMENT_CHIPS.map((key) => ({ key, label: t(`announcements.chips.${key}`), count: key === 'active' ? activeCount : key === 'scheduled' ? scheduledCount : undefined }))}
                value={search.chip}
                onChange={(chip) => updateSearch({ chip })}
              />
            }
            search={<SearchInput defaultValue={search.search} placeholder={t('announcements.searchPlaceholder')} onApply={(value) => updateSearch({ search: value })} />}
          />
        }
        onPageChange={(page) => updateSearch({ page })}
        onRowClick={(row) => setSelectedId(row.id)}
      />

      <AnnouncementDrawer
        announcement={selected}
        canManage={canManage}
        timezone={timezone}
        onClose={() => setSelectedId(null)}
        onEdit={(announcement) => {
          setSelectedId(null)
          setForm({ open: true, editing: announcement })
        }}
      />
      <AnnouncementFormDrawer
        editing={form.editing}
        locationId={locationId}
        locationName={locationName}
        opened={form.open}
        timezone={timezone}
        onClose={() => setForm((current) => ({ ...current, open: false }))}
      />
    </div>
  )
}
