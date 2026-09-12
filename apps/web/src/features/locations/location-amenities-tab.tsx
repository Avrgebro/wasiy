import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { AddIcon } from '@solar-icons/react/linear'
import { notifySuccess } from '../../lib/notify'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '../../components/table/data-table'
import { openRowColumn } from '../../components/table/open-row-column'
import { StatusPill } from '../../components/ui/chips'
import { getErrorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { openDaysLabel } from '../../lib/open-days'
import {
  deactivateAmenity,
  getAmenities,
  reactivateAmenity,
  type AmenitySummary,
} from './amenities-api'
import { AmenityFormDrawer } from './amenity-form-drawer'

const DETAIL = 'text-sm text-[var(--mantine-color-dimmed)]'

function feeCell(t: (key: string, options?: Record<string, unknown>) => string, amenity: AmenitySummary) {
  if (!amenity.is_reservable) {
    return '—'
  }

  if (!amenity.fee_amount_minor && !amenity.deposit_amount_minor) {
    return t('amenities.noFee')
  }

  const fee = amenity.fee_amount_minor ? formatMoney(amenity.fee_amount_minor) : t('amenities.noFee')

  return amenity.deposit_amount_minor
    ? t('amenities.feeWithDeposit', { fee, deposit: formatMoney(amenity.deposit_amount_minor) })
    : fee
}

/**
 * The Amenidades tab (mockup 04): a table — amenities carry a policy
 * summary that reads fine in columns here, unlike the photo-led location
 * tiles. Rows follow the shared table contract: the whole row opens the
 * edit drawer, which carries deactivate/reactivate in its danger zone.
 */
export function LocationAmenitiesTab({
  accountId,
  locationId,
  readOnly,
}: {
  accountId: string
  locationId: string
  readOnly: boolean
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [drawerOpened, setDrawerOpened] = useState(false)
  const [editing, setEditing] = useState<AmenitySummary | null>(null)
  const [deactivating, setDeactivating] = useState<AmenitySummary | null>(null)

  const listQuery = useQuery({
    queryKey: ['locations', 'amenities', accountId, locationId],
    queryFn: () => getAmenities(accountId, locationId),
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['locations'] })
  }

  const reactivateMutation = useMutation({
    mutationFn: (amenity: AmenitySummary) => reactivateAmenity(accountId, locationId, amenity.id),
    onSuccess: async () => {
      await invalidate()
      notifySuccess(t('amenities.reactivated'))
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (amenity: AmenitySummary) => deactivateAmenity(accountId, locationId, amenity.id),
    onSuccess: async () => {
      setDeactivating(null)
      setDrawerOpened(false)
      await invalidate()
      notifySuccess(t('amenities.deactivated'))
    },
  })

  const amenities = listQuery.data?.data ?? []
  // Reflect list refreshes (reactivate) in the open drawer.
  const current = editing ? (amenities.find((amenity) => amenity.id === editing.id) ?? editing) : null

  function openCreate() {
    setEditing(null)
    setDrawerOpened(true)
  }

  function openEdit(amenity: AmenitySummary) {
    setEditing(amenity)
    setDrawerOpened(true)
  }

  const columns = useMemo<ColumnDef<AmenitySummary>[]>(() => {
    const base: ColumnDef<AmenitySummary>[] = [
      {
        accessorKey: 'name',
        header: t('amenities.columns.amenity'),
        cell: ({ row }) => (
          <div className="flex min-w-44 items-center gap-3">
            <span className="relative h-8 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--wa-surface-2)]">
              {row.original.cover_photo_url ? (
                <img alt="" className="absolute inset-0 size-full object-cover" src={row.original.cover_photo_url} />
              ) : null}
            </span>
            <div className="min-w-0">
              <Text fw={600} size="sm" truncate>
                {row.original.name}
              </Text>
            </div>
          </div>
        ),
      },
      // Secondary columns: plain spans, not Text (its text-wrap: wrap undoes
      // the table's single-line cells), and hidden on phones — the drawer
      // shows the full policy; the row only needs name and status there.
      {
        id: 'openDays',
        header: t('amenities.columns.openDays'),
        meta: { hideBelow: 'lg' },
        cell: ({ row }) => (
          <span className={DETAIL}>{row.original.is_reservable ? openDaysLabel(row.original.open_days, t) : '—'}</span>
        ),
      },
      {
        id: 'capacity',
        header: t('amenities.columns.capacity'),
        meta: { hideBelow: 'lg' },
        cell: ({ row }) => (
          <span className={DETAIL}>{row.original.is_reservable && row.original.daily_capacity !== null ? row.original.daily_capacity : '—'}</span>
        ),
      },
      {
        id: 'fee',
        header: t('amenities.columns.fee'),
        meta: { hideBelow: 'lg' },
        cell: ({ row }) => <span className={DETAIL}>{feeCell(t, row.original)}</span>,
      },
      {
        id: 'approval',
        header: t('amenities.columns.approval'),
        meta: { hideBelow: 'lg' },
        cell: ({ row }) => (
          <span className={DETAIL}>
            {row.original.is_reservable
              ? row.original.booking_mode === 'approval'
                ? t('amenities.approval')
                : t('amenities.instant')
              : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('registry.status'),
        cell: ({ row }) => {
          const deactivated = row.original.status === 'deactivated'
          return (
            <StatusPill color={deactivated ? 'gray' : row.original.is_reservable ? 'success' : 'teal'}>
              {deactivated
                ? t('amenities.statuses.deactivated')
                : row.original.is_reservable
                  ? t('amenities.statuses.reservable')
                  : t('amenities.statuses.common')}
            </StatusPill>
          )
        },
      },
    ]

    return readOnly ? base : [...base, openRowColumn()]
  }, [readOnly, t])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text c="dimmed" size="sm">
          {t('amenities.summary', {
            count: amenities.length,
            reservable: amenities.filter((amenity) => amenity.is_reservable && amenity.status === 'active').length,
          })}
        </Text>
        {readOnly ? null : (
          <Button color="accent" leftSection={<AddIcon size={18} />} onClick={openCreate}>
            {t('amenities.add')}
          </Button>
        )}
      </div>

      {listQuery.isError ? (
        <Alert color="error" title={t('errors.loadFailed')}>
          {getErrorMessage(listQuery.error)}
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        data={amenities}
        emptyActions={
          readOnly ? undefined : (
            <Button color="accent" leftSection={<AddIcon size={18} />} mt="sm" onClick={openCreate}>
              {t('amenities.add')}
            </Button>
          )
        }
        loading={listQuery.isLoading}
        rowClassName={(amenity) => (amenity.status === 'deactivated' ? 'opacity-60' : undefined)}
        selectedId={drawerOpened ? current?.id : null}
        onRowClick={readOnly ? undefined : openEdit}
      />

      <Text c="dimmed" size="xs">
        {t('amenities.pausedFootnote')}
      </Text>

      <AmenityFormDrawer
        accountId={accountId}
        editing={current}
        locationId={locationId}
        opened={drawerOpened}
        reactivating={reactivateMutation.isPending}
        onClose={() => setDrawerOpened(false)}
        onDeactivate={current ? () => setDeactivating(current) : undefined}
        onReactivate={current ? () => reactivateMutation.mutate(current) : undefined}
      />

      <Modal
        opened={deactivating !== null}
        title={t('amenities.deactivateConfirmTitle', { name: deactivating?.name ?? '' })}
        onClose={() => setDeactivating(null)}
      >
        <Stack gap="md">
          <Text c="dimmed" size="sm">
            {t('amenities.deactivateHint')}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeactivating(null)}>
              {t('actions.cancel')}
            </Button>
            <Button
              color="error"
              loading={deactivateMutation.isPending}
              onClick={() => deactivating && deactivateMutation.mutate(deactivating)}
            >
              {t('locations.deactivate')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  )
}
