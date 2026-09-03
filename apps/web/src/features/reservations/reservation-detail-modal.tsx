import { Badge, Button, Group, Modal, Text } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { formatDate } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { getErrorMessage } from '../../lib/errors'
import { notifyError, notifySuccess } from '../../lib/notify'
import { transitionMovement, type MovementStatus, type MovementSummary } from '../finances/api'
import {
  amountClassName,
  primaryTransition,
  statusColor,
  statusLabel,
  transitionLabel,
} from '../finances/movement-presentation'
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
    // Approval and cancellation write ledger rows too.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['reservations'] }),
      queryClient.invalidateQueries({ queryKey: ['finances'] }),
    ])
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

  const movementMutation = useMutation({
    mutationFn: ({ movement, status }: { movement: MovementSummary; status: MovementStatus }) =>
      transitionMovement(accountId, movement.id, status),
    onSuccess: async () => {
      await invalidate()
      notifySuccess(t('finances.updated'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  const isOpenRequest =
    reservation?.status === 'pending' || reservation?.status === 'observed'
  const cancellable =
    reservation !== null &&
    (isOpenRequest || (reservation.status === 'approved' && !reservation.is_completed))
  const money = (amount: number | null) => (amount === null ? '—' : formatMoney(amount))

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
          </div>

          {/* Cobros: the ledger rows once approved, the snapshot prices before. */}
          <div className="flex flex-col gap-2">
            <Text c="dimmed" fw={600} size="xs" tt="uppercase">
              {t('reservations.detail.charges')}
            </Text>
            {reservation.movements && reservation.movements.length > 0 ? (
              reservation.movements.map((movement) => {
                const next = primaryTransition(movement)

                return (
                  <div
                    key={movement.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-[var(--mantine-color-default-border)] px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 text-sm font-medium">
                      {t(
                        movement.category === 'reservation_deposit'
                          ? 'reservations.detail.deposit'
                          : 'reservations.detail.fee',
                      )}
                    </span>
                    <span className={`font-mono text-sm font-semibold ${amountClassName(movement)}`}>
                      {formatMoney(movement.amount)}
                    </span>
                    <Badge color={statusColor(movement.status)} radius="xl" size="sm" variant="light">
                      {statusLabel(movement, t)}
                    </Badge>
                    {canDecide && next ? (
                      <Button
                        loading={
                          movementMutation.isPending &&
                          movementMutation.variables?.movement.id === movement.id
                        }
                        size="compact-xs"
                        variant="subtle"
                        onClick={() => movementMutation.mutate({ movement, status: next })}
                      >
                        {transitionLabel(next, t)}
                      </Button>
                    ) : null}
                  </div>
                )
              })
            ) : reservation.fee_snapshot === null && reservation.deposit_snapshot === null ? (
              <Text c="dimmed" size="sm">
                {t('reservations.queue.free')}
              </Text>
            ) : (
              <>
                <Text size="sm">
                  {[
                    reservation.fee_snapshot !== null
                      ? `${t('reservations.detail.fee')} ${money(reservation.fee_snapshot)}`
                      : null,
                    reservation.deposit_snapshot !== null
                      ? `${t('reservations.detail.deposit')} ${money(reservation.deposit_snapshot)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <Text c="dimmed" size="xs">
                  {t(isOpenRequest ? 'reservations.detail.chargesOnApproval' : 'reservations.detail.feeHint')}
                </Text>
              </>
            )}
          </div>

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
