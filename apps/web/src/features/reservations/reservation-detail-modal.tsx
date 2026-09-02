import { Button, Group, Modal, Text } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { formatDate } from '../../lib/dates'
import { getErrorMessage } from '../../lib/errors'
import { notifyError, notifySuccess } from '../../lib/notify'
import { approveReservation, cancelReservation, type ReservationSummary } from './api'
import { ReservationField as Field, ReservationSlotBand } from './reservation-modal-parts'

/**
 * The reservation detail, opened from a list row. Beyond the row it shows
 * what has no other home in the UI: the fee/deposit snapshots (prices as
 * they were when booked — cobro is manual), the audit trail, and the
 * decision note. Actions follow the status: approve for open requests,
 * cancel for open or approved ones.
 */
export function ReservationDetailModal({
  accountId,
  canDecide,
  onClose,
  reservation,
  timezone,
}: {
  accountId: string
  canDecide: boolean
  onClose: () => void
  reservation: ReservationSummary | null
  timezone: string
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['reservations'] })
  }

  const approveMutation = useMutation({
    mutationFn: (reservationId: string) => approveReservation(accountId, reservationId),
    onSuccess: async () => {
      await invalidate()
      onClose()
      notifySuccess(t('reservations.toasts.approved'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })
  const cancelMutation = useMutation({
    mutationFn: (reservationId: string) => cancelReservation(accountId, reservationId),
    onSuccess: async () => {
      await invalidate()
      onClose()
      notifySuccess(t('reservations.toasts.cancelled'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  const isOpenRequest =
    reservation?.status === 'pending' || reservation?.status === 'observed'
  const cancellable =
    reservation !== null &&
    (isOpenRequest || (reservation.status === 'approved' && !reservation.is_completed))
  const money = (amount: number | null) => (amount === null ? '—' : `S/ ${amount}`)

  return (
    <Modal
      opened={reservation !== null}
      radius={14}
      title={
        <span className="text-base font-semibold">{reservation?.amenity_name}</span>
      }
      onClose={onClose}
    >
      {reservation ? (
        <div className="flex flex-col gap-4">
          <ReservationSlotBand reservation={reservation} timezone={timezone} />

          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            <Field label={t('reservations.columns.unit')} value={reservation.unit_number ?? '—'} />
            <Field
              label={t('reservations.columns.resident')}
              value={reservation.resident_name ?? '—'}
            />
            <Field
              label={t('reservations.detail.fee')}
              value={
                reservation.fee_snapshot === null && reservation.deposit_snapshot === null ? (
                  t('reservations.queue.free')
                ) : (
                  <span className="font-semibold text-[var(--wa-warning)]">
                    {money(reservation.fee_snapshot)}
                  </span>
                )
              }
            />
            <Field
              label={t('reservations.detail.deposit')}
              value={
                reservation.deposit_snapshot === null ? (
                  '—'
                ) : (
                  <span className="font-semibold text-[var(--wa-warning)]">
                    {money(reservation.deposit_snapshot)}
                  </span>
                )
              }
            />
          </div>
          {reservation.fee_snapshot !== null || reservation.deposit_snapshot !== null ? (
            <Text c="dimmed" mt={-8} size="xs">
              {t('reservations.detail.feeHint')}
            </Text>
          ) : null}

          {reservation.status_note ? (
            <div className="rounded-[10px] border border-[var(--wa-info)]/40 bg-[var(--wa-info)]/10 px-3.5 py-2.5">
              <Text fw={600} size="xs">
                {t('reservations.detail.note')}
              </Text>
              <Text mt={2} size="sm">
                {reservation.status_note}
              </Text>
            </div>
          ) : null}

          {/* Audit trail: who registered it, who decided it. */}
          <div className="flex flex-col gap-1 border-t border-[var(--mantine-color-default-border)] pt-3">
            {reservation.created_at ? (
              <Text c="dimmed" size="xs">
                {t('reservations.detail.createdBy', {
                  name: reservation.created_by_name ?? '—',
                  date: formatDate(reservation.created_at),
                })}
              </Text>
            ) : null}
            {reservation.decided_at && reservation.decided_by_name ? (
              <Text c="dimmed" size="xs">
                {t(`reservations.statuses.${reservation.status}`)}{' '}
                {t('reservations.detail.decidedBy', {
                  name: reservation.decided_by_name,
                  date: formatDate(reservation.decided_at),
                })}
              </Text>
            ) : null}
          </div>

          {canDecide && (cancellable || isOpenRequest) ? (
            <Group justify="flex-end">
              {cancellable ? (
                <Button
                  color="error"
                  loading={cancelMutation.isPending}
                  variant="outline"
                  onClick={() => cancelMutation.mutate(reservation.id)}
                >
                  {t('reservations.actions.cancel')}
                </Button>
              ) : null}
              {isOpenRequest ? (
                <Button
                  color="accent"
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(reservation.id)}
                >
                  {t('reservations.actions.approve')}
                </Button>
              ) : null}
            </Group>
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}
