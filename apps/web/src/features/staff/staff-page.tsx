import { Alert, Button, Text } from '@mantine/core'
import { AddCircle } from '@solar-icons/react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'
import { showNotification } from '@mantine/notifications'
import { useMe } from '../auth/hooks'
import type { MeResponse } from '../auth/types'
import { DataTable } from '../../components/table/data-table'
import { getPendingStaffInvitations, getStaff, reactivateStaff, type StaffSummary } from './api'
import { PendingInvitations } from './pending-invitations'
import { StaffAccessDrawer } from './staff-access-drawer'
import { StaffDeactivateModal } from './staff-deactivate-modal'
import { useStaffColumns } from './staff-columns'
import { StaffEmptyState } from './staff-empty-state'
import { StaffFilters } from './staff-filters'
import { staffRowClassName } from './staff-status'

const routeApi = getRouteApi('/_authenticated/admin/staff')

export function StaffPage() {
  const { t } = useTranslation('common')
  const meQuery = useMe()
  const me = meQuery.data
  const account = me?.active_account

  if (!me || !account) {
    return (
      <Alert color="warning" title={t('auth.noAccessTitle')}>
        {t('accountSelection.title')}
      </Alert>
    )
  }

  return <StaffPageContent accountId={account.id} me={me} />
}

function StaffPageContent({ accountId, me }: { accountId: string; me: MeResponse }) {
  const { t } = useTranslation('common')
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  const queryClient = useQueryClient()
  const [drawerOpened, setDrawerOpened] = useState(false)
  const [editing, setEditing] = useState<StaffSummary | null>(null)
  const [deactivating, setDeactivating] = useState<StaffSummary | null>(null)

  const locationOptions = me.accessible_locations.map((location) => ({
    label: location.name,
    value: location.id,
  }))
  const locationNames = new Map(me.accessible_locations.map((location) => [location.id, location.name]))

  // Both keys share the ['staff'] prefix so mutations can invalidate the
  // whole feature at once; only the list key varies with the URL filters,
  // which is why paging never refetches the invitations query.
  const listQuery = useQuery({
    queryKey: ['staff', 'list', accountId, search],
    queryFn: () => getStaff(accountId, search),
    // Page/filter changes produce a new cache key; keeping the previous
    // response swaps rows in place instead of dropping to a loader.
    placeholderData: keepPreviousData,
  })
  const invitationsQuery = useQuery({
    queryKey: ['staff', 'invitations', accountId],
    queryFn: () => getPendingStaffInvitations(accountId),
  })

  function updateSearch(next: Partial<typeof search>) {
    void navigate({
      search: (current) => ({
        ...current,
        ...next,
        page: next.page ?? 1,
      }),
    })
  }

  function openInvite() {
    setEditing(null)
    setDrawerOpened(true)
  }

  function openEdit(staff: StaffSummary) {
    setEditing(staff)
    setDrawerOpened(true)
  }

  const reactivateMutation = useMutation({
    mutationFn: (staff: StaffSummary) => reactivateStaff(accountId, staff.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['staff'] })
      showNotification({ color: 'green', message: t('staff.reactivated') })
    },
    onError: (error) => {
      showNotification({ color: 'red', message: getErrorMessage(error) })
    },
  })

  const columns = useStaffColumns({
    meUserId: me.user.id,
    onDeactivate: setDeactivating,
    onEdit: openEdit,
    onReactivate: (staff) => reactivateMutation.mutate(staff),
  })

  const rows = listQuery.data?.data ?? []
  const isFiltered = Boolean(search.search || search.role || search.location_id || search.status)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-bold text-[var(--mantine-color-text)]">
            {t('staff.title')}
          </h1>
          <Text c="dimmed" mt={6} size="sm">
            {t('staff.subtitle')}
          </Text>
        </div>
        <Button color="accent" leftSection={<AddCircle size={20} />} onClick={openInvite}>
          {t('staff.invite')}
        </Button>
      </div>

      {invitationsQuery.data ? (
        <PendingInvitations
          accountId={accountId}
          invitations={invitationsQuery.data.data}
          locationNames={locationNames}
        />
      ) : null}

      {listQuery.isError ? (
        <Alert color="error" title={t('errors.loadFailed')}>
          {getErrorMessage(listQuery.error)}
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        emptyState={<StaffEmptyState filtered={isFiltered} onInvite={openInvite} />}
        fetching={listQuery.isPlaceholderData}
        loading={listQuery.isLoading}
        meta={listQuery.data?.meta}
        rowClassName={staffRowClassName}
        toolbar={<StaffFilters locations={locationOptions} search={search} onChange={updateSearch} />}
        onPageChange={(page) => updateSearch({ page })}
      />

      <StaffAccessDrawer
        accountId={accountId}
        editing={editing}
        locations={locationOptions}
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        onDeactivate={
          editing && editing.id !== me.user.id
            ? () => {
                setDrawerOpened(false)
                setDeactivating(editing)
              }
            : undefined
        }
      />
      <StaffDeactivateModal
        accountId={accountId}
        staff={deactivating}
        onClose={() => setDeactivating(null)}
      />
    </div>
  )
}
