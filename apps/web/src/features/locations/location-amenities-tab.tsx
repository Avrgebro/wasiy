import { Alert, Button, Group, Modal, Skeleton, Stack, Table, Text } from '@mantine/core'
import { notifySuccess, notifyError } from '../../lib/notify'
import { AddCircle, Confetti } from '@solar-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessChip, TintChip } from '../../components/ui/chips'
import { getErrorMessage } from '../../lib/errors'
import {
  deactivateAmenity,
  getAmenities,
  reactivateAmenity,
  type AmenitySummary,
} from './amenities-api'
import { AmenityFormDrawer } from './amenity-form-drawer'
import { summarizeAvailability } from './amenity-schedule'

function feeCell(t: (key: string, options?: Record<string, unknown>) => string, amenity: AmenitySummary) {
  if (!amenity.is_reservable) {
    return '—'
  }

  if (!amenity.fee_amount && !amenity.deposit_amount) {
    return t('amenities.noFee')
  }

  const fee = amenity.fee_amount ? `S/ ${amenity.fee_amount}` : t('amenities.noFee')

  return amenity.deposit_amount
    ? t('amenities.feeWithDeposit', { fee, deposit: `S/ ${amenity.deposit_amount}` })
    : fee
}

/**
 * The Amenidades tab (mockup 04): a table — amenities carry a policy
 * summary that reads fine in columns here, unlike the photo-led location
 * tiles. Actions are inline text links, matching the design.
 */
export function LocationAmenitiesTab({
  accountId,
  locationId,
  readOnly,
  timezone,
}: {
  accountId: string
  locationId: string
  readOnly: boolean
  timezone: string
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
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  const deactivateMutation = useMutation({
    mutationFn: (amenity: AmenitySummary) => deactivateAmenity(accountId, locationId, amenity.id),
    onSuccess: async () => {
      setDeactivating(null)
      await invalidate()
      notifySuccess(t('amenities.deactivated'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  if (listQuery.isLoading) {
    return <Skeleton height={260} radius="lg" />
  }

  if (listQuery.isError) {
    return (
      <Alert color="error" title={t('errors.loadFailed')}>
        {getErrorMessage(listQuery.error)}
      </Alert>
    )
  }

  const amenities = listQuery.data?.data ?? []

  function openCreate() {
    setEditing(null)
    setDrawerOpened(true)
  }

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
          <Button color="accent" leftSection={<AddCircle size={18} />} onClick={openCreate}>
            {t('amenities.add')}
          </Button>
        )}
      </div>

      {amenities.length === 0 ? (
        <div className="grid min-h-64 place-items-center rounded-[14px] border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <Confetti className="text-[var(--mantine-color-dimmed)]" size={26} />
            <Text fw={700}>{t('amenities.empty.title')}</Text>
            <Text c="dimmed" size="sm">
              {t('amenities.empty.body')}
            </Text>
            {readOnly ? null : (
              <Button color="accent" leftSection={<AddCircle size={18} />} mt="sm" onClick={openCreate}>
                {t('amenities.add')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('amenities.columns.amenity')}</Table.Th>
                <Table.Th>{t('amenities.columns.schedule')}</Table.Th>
                <Table.Th>{t('amenities.columns.capacity')}</Table.Th>
                <Table.Th>{t('amenities.columns.fee')}</Table.Th>
                <Table.Th>{t('amenities.columns.approval')}</Table.Th>
                <Table.Th>{t('registry.status')}</Table.Th>
                <Table.Th className="text-right">{t('amenities.columns.actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {amenities.map((amenity) => {
                const deactivated = amenity.status === 'deactivated'
                const schedule = summarizeAvailability(amenity.availability)

                return (
                  <Table.Tr key={amenity.id} className={deactivated ? 'opacity-60' : ''}>
                    <Table.Td>
                      <div className="flex min-w-44 items-center gap-3">
                        <span className="relative h-8 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--wa-surface-2)]">
                          {amenity.cover_photo_url ? (
                            <img alt="" className="absolute inset-0 size-full object-cover" src={amenity.cover_photo_url} />
                          ) : null}
                        </span>
                        <div className="min-w-0">
                          <Text fw={600} size="sm" truncate>
                            {amenity.name}
                          </Text>
                          <div className="mt-1">
                            <AccessChip>{t(`amenities.types.${amenity.type}`)}</AccessChip>
                          </div>
                        </div>
                      </div>
                    </Table.Td>
                    <Table.Td className="whitespace-nowrap">
                      <Text c="dimmed" size="sm">
                        {schedule === 'variable'
                          ? t('amenities.variableSchedule')
                          : schedule ?? '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text c="dimmed" size="sm">
                        {amenity.capacity ?? '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td className="whitespace-nowrap">
                      <Text c="dimmed" size="sm">
                        {feeCell(t, amenity)}
                      </Text>
                    </Table.Td>
                    <Table.Td className="whitespace-nowrap">
                      <Text c="dimmed" size="sm">
                        {amenity.is_reservable
                          ? amenity.booking_mode === 'approval'
                            ? t('amenities.approval')
                            : t('amenities.instant')
                          : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <TintChip color={deactivated ? 'gray' : amenity.is_reservable ? 'success' : 'teal'}>
                        {deactivated
                          ? t('amenities.statuses.deactivated')
                          : amenity.is_reservable
                            ? t('amenities.statuses.reservable')
                            : t('amenities.statuses.common')}
                      </TintChip>
                    </Table.Td>
                    <Table.Td className="whitespace-nowrap">
                      {readOnly ? null : (
                        <div className="flex justify-end gap-3 text-xs font-medium">
                          {deactivated ? (
                            <button
                              className="cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-[var(--wa-interactive)]"
                              type="button"
                              onClick={() => reactivateMutation.mutate(amenity)}
                            >
                              {t('locations.reactivate')}
                            </button>
                          ) : (
                            <>
                              <button
                                className="cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-[var(--wa-interactive)]"
                                type="button"
                                onClick={() => {
                                  setEditing(amenity)
                                  setDrawerOpened(true)
                                }}
                              >
                                {t('actions.edit')}
                              </button>
                              <button
                                className="cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-[var(--mantine-color-dimmed)]"
                                type="button"
                                onClick={() => setDeactivating(amenity)}
                              >
                                {t('locations.deactivate')}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </div>
      )}

      <Text c="dimmed" size="xs">
        {t('amenities.pausedFootnote')}
      </Text>

      <AmenityFormDrawer
        accountId={accountId}
        editing={editing}
        locationId={locationId}
        opened={drawerOpened}
        timezone={timezone}
        onClose={() => setDrawerOpened(false)}
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
