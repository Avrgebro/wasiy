import { Button, Skeleton, Text, Textarea } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePhoneFormat } from '../auth/hooks'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import {
  ConfirmDialog,
  DrawerFact,
  DrawerFacts,
  DrawerSection,
  DrawerTimeline,
  type TimelineItem,
} from '../../components/ui/detail-drawer-parts'
import { formatDate } from '../../lib/dates'
import { getErrorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { notifySuccess } from '../../lib/notify'
import { transitionMovement, type MovementStatus, type MovementSummary } from '../finances/api'
import { shortDateTime } from '../finances/month'
import {
  amountClassName,
  primaryTransition,
  statusColor,
  statusLabel,
  transitionLabel,
} from '../finances/movement-presentation'
import {
  approveReservation,
  cancelReservation,
  getReservation,
  observeReservation,
  rejectReservation,
  type ReservationHistoryEntry,
  type ReservationSummary,
} from './api'
import { ReservationSlotBand } from './reservation-modal-parts'
import { StatusPill } from '../../components/ui/chips'

type Decision = 'approve' | 'observe' | 'reject' | 'cancel'

/**
 * The booking's home (mockup 08 drawer): slot and status, facts, Cobros
 * with the same forward action as Finanzas, a Historial that merges the
 * reservation's events with its movements', and the decisions with one
 * note field. Front desk sees everything and decides nothing.
 */
export function ReservationDrawer({
  accountId,
  canDecide,
  onClose,
  reservationId,
  timezone,
}: {
  accountId: string
  canDecide: boolean
  onClose: () => void
  reservationId: string | null
  timezone: string
}) {
  const { t } = useTranslation('common')
  const formatPhone = usePhoneFormat()
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const close = () => {
    setNote('')
    onClose()
  }

  const detailQuery = useQuery({
    enabled: reservationId !== null,
    queryKey: ['reservations', 'detail', accountId, reservationId],
    queryFn: () => getReservation(accountId, reservationId!),
  })

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['reservations'] }),
      queryClient.invalidateQueries({ queryKey: ['finances'] }),
    ])

  const decide = useMutation({
    mutationFn: (kind: Decision) => {
      const trimmed = note.trim()
      switch (kind) {
        case 'approve':
          return approveReservation(accountId, reservationId!)
        case 'observe':
          return observeReservation(accountId, reservationId!, trimmed)
        case 'reject':
          return rejectReservation(accountId, reservationId!, trimmed)
        default:
          return cancelReservation(accountId, reservationId!, trimmed || undefined)
      }
    },
    onSuccess: async (_response, kind) => {
      await invalidate()
      setNote('')
      notifySuccess(t(`reservations.toasts.${kind === 'approve' ? 'approved' : kind === 'observe' ? 'observed' : kind === 'reject' ? 'rejected' : 'cancelled'}`))
    },
  })

  const settle = useMutation({
    mutationFn: ({ movement, status }: { movement: MovementSummary; status: MovementStatus }) =>
      transitionMovement(accountId, movement.id, status),
    onSuccess: async () => {
      await invalidate()
      notifySuccess(t('finances.updated'))
    },
  })

  const reservation = detailQuery.data?.data
  const history = detailQuery.data?.history ?? []

  return (
    <AppDrawer
      opened={reservationId !== null}
      subtitle={
        reservation
          ? [t('reservations.detail.kind'), reservation.unit_number, reservation.resident_name]
              .filter(Boolean)
              .join(' · ')
          : undefined
      }
      title={reservation?.amenity_name ?? t('reservations.detail.title')}
      onClose={close}
    >
      <AppDrawerBody>
        {detailQuery.isError ? (
          <Text c="error">{getErrorMessage(detailQuery.error)}</Text>
        ) : !reservation ? (
          <Skeleton height={240} radius="md" />
        ) : (
          <>
            <ReservationSlotBand reservation={reservation} timezone={timezone} />

            <DrawerFacts>
              <DrawerFact
                label={t('reservations.columns.unit')}
                value={
                  reservation.unit_number ? (
                    <Link
                      className="text-[var(--wa-interactive)] no-underline hover:underline"
                      params={{ unitId: reservation.unit_id }}
                      to="/admin/units/$unitId"
                    >
                      {reservation.unit_number} →
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <DrawerFact
                label={t('reservations.columns.resident')}
                value={[reservation.resident_name, formatPhone(reservation.resident_phone)].filter(Boolean).join(' · ') || '—'}
              />
              <DrawerFact
                label={t('reservations.detail.registeredBy')}
                value={[reservation.created_by_name, reservation.created_at ? formatDate(reservation.created_at) : null]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              />
              {reservation.decided_at && reservation.decided_by_name ? (
                <DrawerFact
                  label={t(`reservations.detail.decidedLabel.${reservation.status}`)}
                  value={`${reservation.decided_by_name} · ${formatDate(reservation.decided_at)}`}
                />
              ) : null}
              {reservation.status_note ? (
                <DrawerFact wide label={t('reservations.detail.decisionNote')} value={reservation.status_note} />
              ) : null}
            </DrawerFacts>

            <DrawerSection label={t('reservations.detail.charges')} />
            <Charges
              canDecide={canDecide}
              loadingId={settle.isPending ? settle.variables?.movement.id : undefined}
              reservation={reservation}
              onSettle={(movement, status) => settle.mutate({ movement, status })}
            />

            <DrawerSection label={t('finances.history.title')} />
            <DrawerTimeline items={timelineItems(reservation, history, timezone, t)} />

            {canDecide ? (
              <Decisions
                loading={decide.isPending}
                note={note}
                reservation={reservation}
                onCancel={() => setConfirmingCancel(true)}
                onDecide={(kind) => decide.mutate(kind)}
                onNote={setNote}
              />
            ) : null}
            <ConfirmDialog
              body={t('reservations.detail.confirmCancelBody')}
              opened={confirmingCancel}
              title={t('reservations.detail.confirmCancel')}
              onCancel={() => setConfirmingCancel(false)}
              onConfirm={() => {
                setConfirmingCancel(false)
                decide.mutate('cancel')
              }}
            />
          </>
        )}
      </AppDrawerBody>
      <AppDrawerFooter>
        <Button className="mr-auto" variant="subtle" onClick={close}>
          {t('finances.detail.close')}
        </Button>
      </AppDrawerFooter>
    </AppDrawer>
  )
}

function Charges({
  canDecide,
  loadingId,
  onSettle,
  reservation,
}: {
  canDecide: boolean
  loadingId?: string
  onSettle: (movement: MovementSummary, status: MovementStatus) => void
  reservation: ReservationSummary
}) {
  const { t } = useTranslation('common')
  const movements = reservation.movements ?? []

  if (movements.length === 0) {
    const free = reservation.fee_snapshot === null && reservation.deposit_snapshot === null

    return (
      <Text c="dimmed" size="sm">
        {free
          ? t('reservations.queue.free')
          : [
              reservation.fee_snapshot !== null ? `${t('reservations.detail.fee')} ${formatMoney(reservation.fee_snapshot)}` : null,
              reservation.deposit_snapshot !== null ? `${t('reservations.detail.deposit')} ${formatMoney(reservation.deposit_snapshot)}` : null,
            ]
              .filter(Boolean)
              .join(' · ') + ` — ${t('reservations.detail.chargesOnApproval')}`}
      </Text>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {movements.map((movement) => {
        const next = canDecide ? primaryTransition(movement) : null

        return (
          <div
            key={movement.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-inner border border-[var(--mantine-color-default-border)] px-3 py-2"
          >
            <span className="min-w-0 flex-1 text-sm font-medium">
              {t(movement.category === 'reservation_deposit' ? 'reservations.detail.deposit' : 'reservations.detail.fee')}
            </span>
            <span className={`font-mono text-sm font-semibold ${amountClassName(movement)}`}>
              {formatMoney(movement.amount)}
            </span>
            <StatusPill color={statusColor(movement.status)}>
              {statusLabel(movement, t)}
            </StatusPill>
            {next ? (
              <Button
                loading={loadingId === movement.id}
                size="compact-xs"
                variant="subtle"
                onClick={() => onSettle(movement, next)}
              >
                {transitionLabel(next, t)}
              </Button>
            ) : (
              <Link
                className="text-xs font-medium text-[var(--wa-interactive)] no-underline hover:underline"
                search={{
                  month: movement.occurred_on.slice(0, 7),
                  movement: movement.id,
                  chip: undefined,
                  search: '',
                  status: '',
                  category: '',
                  sort: '',
                  page: 1,
                }}
                to="/admin/finances"
              >
                {t('reservations.detail.viewInFinances')}
              </Link>
            )}
          </div>
        )
      })}
    </div>
  )
}

function timelineItems(
  reservation: ReservationSummary,
  history: ReservationHistoryEntry[],
  timezone: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): TimelineItem[] {
  const items: TimelineItem[] = history.map((entry) => {
    const when = entry.created_at ? shortDateTime(entry.created_at, timezone) : '—'

    if (entry.subject === 'reservation') {
      const verb = entry.event_type.split('.')[1]
      const label = t(`reservations.history.${verb}`)

      return {
        id: entry.id,
        when,
        label: entry.note ? `${label}: ${entry.note}` : label,
        actor: entry.actor_name ?? '—',
      }
    }

    const charge = t(entry.category === 'reservation_deposit' ? 'reservations.detail.deposit' : 'reservations.detail.fee')
    const amount = entry.amount !== null ? ` ${formatMoney(entry.amount)}` : ''

    if (entry.event_type === 'movement.recorded') {
      return {
        id: entry.id,
        when,
        label: t('reservations.history.chargeGenerated', { charge: `${charge}${amount}` }),
        actor: t('finances.history.system'),
      }
    }

    return {
      id: entry.id,
      when,
      label: `${charge} · ${t(`finances.history.${entry.status ?? 'pending'}`)}`,
      actor: entry.actor_name ?? '—',
    }
  })

  if (reservation.is_completed) {
    items.unshift({
      id: 'derived-completed',
      derived: true,
      when: shortDateTime(reservation.ends_at, timezone),
      label: t('reservations.history.completed'),
      actor: t('reservations.history.derived'),
    })
  }

  return items
}

function Decisions({
  loading,
  note,
  onCancel,
  onDecide,
  onNote,
  reservation,
}: {
  loading: boolean
  note: string
  onCancel: () => void
  onDecide: (kind: Decision) => void
  onNote: (value: string) => void
  reservation: ReservationSummary
}) {
  const { t } = useTranslation('common')
  const open = reservation.status === 'pending' || reservation.status === 'observed'
  const cancellable = open || (reservation.status === 'approved' && !reservation.is_completed)

  if (!open && !cancellable) {
    return null
  }

  const hasNote = note.trim().length > 0

  return (
    <>
      <DrawerSection label={t('finances.detail.actions')} />
      <Textarea
        description={t(open ? 'reservations.detail.noteRequiredHint' : 'reservations.detail.noteHint')}
        label={t('finances.detail.actionNote')}
        rows={3}
        value={note}
        onChange={(event) => onNote(event.currentTarget.value)}
      />
      {/* One row of stretched md buttons, like the movement drawer: the
          primary in accent, the rest default. Open requests are rejected,
          never cancelled, so cancel only appears once a booking is approved. */}
      <div className="flex w-full gap-2.5">
        {open ? (
          <>
            <Button className="flex-1" color="accent" loading={loading} onClick={() => onDecide('approve')}>
              {t('reservations.actions.approve')}
            </Button>
            <Button className="flex-1" disabled={!hasNote || loading} variant="default" onClick={() => onDecide('observe')}>
              {t('reservations.actions.observe')}
            </Button>
            <Button className="flex-1" disabled={!hasNote || loading} variant="default" onClick={() => onDecide('reject')}>
              {t('reservations.actions.reject')}
            </Button>
          </>
        ) : (
          <Button className="flex-1" disabled={loading} variant="default" onClick={onCancel}>
            {t('reservations.actions.cancel')}
          </Button>
        )}
      </div>
    </>
  )
}
