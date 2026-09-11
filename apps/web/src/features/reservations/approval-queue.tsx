import { Badge, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core'
import type { TFunction } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReservationSummary } from './api'
import { ReservationField, ReservationSlotBand } from './reservation-modal-parts'
import { useReservationDecisions } from './use-reservation-decisions'
import { formatTimeRange, localDateString, shortDayLabel } from './week'

type NoteAction = { kind: 'reject' | 'observe'; reservation: ReservationSummary }

// Mockup 08 shows a short stack and a "Ver las N pendientes" link; the rail
// must not dwarf the agenda when requests pile up.
const QUEUE_PREVIEW_COUNT = 3

function waitingDays(reservation: ReservationSummary, timezone: string): number | null {
  if (!reservation.created_at) {
    return null
  }

  const received = localDateString(new Date(reservation.created_at), timezone)
  const today = localDateString(new Date(Date.now()), timezone)
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(received)) / 86_400_000))
}

function feeLine(reservation: ReservationSummary, t: TFunction<'common'>) {
  const parts = []
  if (reservation.fee_snapshot) {
    parts.push(t('reservations.queue.fee', { amount: reservation.fee_snapshot }))
  }
  if (reservation.deposit_snapshot) {
    parts.push(t('reservations.queue.deposit', { amount: reservation.deposit_snapshot }))
  }

  return parts.length > 0 ? parts.join(' + ') : t('reservations.queue.free')
}

/**
 * The "Por aprobar" rail. Availability is validated by the approval endpoint
 * inside the amenity lock.
 */
export function ApprovalQueue({
  accountId,
  canDecide,
  requests,
  timezone,
  onSelect,
}: {
  accountId: string
  canDecide: boolean
  requests: ReservationSummary[]
  timezone: string
  /** Opens the booking's drawer; the inline buttons stay the fast path. */
  onSelect?: (reservation: ReservationSummary) => void
}) {
  const { t } = useTranslation('common')
  const [noteAction, setNoteAction] = useState<NoteAction | null>(null)
  const [note, setNote] = useState('')
  const [expanded, setExpanded] = useState(false)

  const decide = useReservationDecisions(accountId, (input) => {
    if (input.kind !== 'approve') {
      setNoteAction(null)
      setNote('')
    }
  })
  const approving = decide.isPending && decide.variables?.kind === 'approve' ? decide.variables.reservationId : null


  return (
    <section className="overflow-hidden rounded-surface border border-[var(--wa-warning)]/40 bg-[var(--mantine-color-default)]">
      <div className="flex items-center gap-2.5 px-5 py-3.5">
        <span className="size-2 rounded-full bg-[var(--wa-warning)]" />
        <Text fw={600}>{t('reservations.queue.title')}</Text>
        {requests.length > 0 ? (
          <Badge color="warning" ml="auto" radius="xl" size="sm" variant="filled">
            {requests.length}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 border-t border-[var(--mantine-color-default-border)] p-4">
        {requests.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('reservations.queue.empty')}
          </Text>
        ) : (
          (expanded ? requests : requests.slice(0, QUEUE_PREVIEW_COUNT)).map((request) => {
            const days = waitingDays(request, timezone)

            return (
              <div
                key={request.id}
                className={`rounded-inner bg-[var(--wa-surface-2)] px-4 py-3.5 ${onSelect ? 'cursor-pointer hover:bg-[var(--mantine-color-default-hover)]' : ''}`}
                onClick={onSelect ? () => onSelect(request) : undefined}
              >
                <div className="flex items-baseline justify-between gap-2.5">
                  <Text fw={600} size="sm" truncate>
                    {request.amenity_name}
                  </Text>
                  <Text c="dimmed" className="shrink-0" size="xs">
                    {shortDayLabel(localDateString(new Date(request.starts_at), timezone))},{' '}
                    {formatTimeRange(request, timezone)}
                  </Text>
                </div>
                <Text c="dimmed" mt={3} size="xs">
                  {[request.unit_number, request.resident_name, feeLine(request, t)]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {days !== null ? (
                  <Text c="dimmed" mt={3} size="xs">
                    {days === 0 ? t('reservations.queue.receivedToday') : t('reservations.queue.waiting', { count: days })}
                  </Text>
                ) : null}
                {request.status === 'observed' && request.status_note ? (
                  <Text c="info" mt={3} size="xs">
                    {t('reservations.statuses.observed')}: {request.status_note}
                  </Text>
                ) : null}
                {canDecide ? (
                  <Group className="pointer-coarse:gap-3" gap={8} grow mt={11} onClick={(event) => event.stopPropagation()}>
                    <Button
                      color="accent"
                      loading={approving === request.id}
                      size="xs"
                      onClick={() => decide.mutate({ kind: 'approve', reservationId: request.id })}
                    >
                      {t('reservations.actions.approve')}
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => setNoteAction({ kind: 'observe', reservation: request })}
                    >
                      {t('reservations.actions.observe')}
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => setNoteAction({ kind: 'reject', reservation: request })}
                    >
                      {t('reservations.actions.reject')}
                    </Button>
                  </Group>
                ) : null}
              </div>
            )
          })
        )}
        {requests.length > QUEUE_PREVIEW_COUNT ? (
          <button
            className="cursor-pointer border-0 bg-transparent p-0 text-left text-[13px] font-medium text-[var(--wa-interactive)] pointer-coarse:min-h-11"
            type="button"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded
              ? t('reservations.queue.showFewer')
              : t('reservations.queue.showAll', { count: requests.length })}
          </button>
        ) : null}
      </div>

      <Modal
        opened={noteAction !== null}
        radius="lg"
        title={
          <span className="text-base font-semibold">
            {noteAction ? t(`reservations.noteModal.${noteAction.kind}Title`) : ''}
          </span>
        }
        onClose={() => {
          setNoteAction(null)
          setNote('')
        }}
      >
        <Stack gap="md">
          {noteAction ? (
            <>
              <ReservationSlotBand reservation={noteAction.reservation} timezone={timezone} />
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                <ReservationField
                  label={t('reservations.columns.amenity')}
                  value={noteAction.reservation.amenity_name ?? '—'}
                />
                <ReservationField
                  label={t('reservations.columns.unit')}
                  value={noteAction.reservation.unit_number ?? '—'}
                />
              </div>
            </>
          ) : null}
          {/* Plain rows, not autosize — Autosize needs layout APIs jsdom lacks. */}
          <Textarea
            data-autofocus
            description={t(`reservations.noteModal.${noteAction?.kind ?? 'observe'}Hint`)}
            label={t('reservations.noteModal.noteLabel')}
            rows={3}
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setNoteAction(null)
                setNote('')
              }}
            >
              {t('actions.cancel')}
            </Button>
            <Button
              color={noteAction?.kind === 'reject' ? 'error' : 'accent'}
              disabled={note.trim().length === 0}
              loading={decide.isPending && decide.variables?.kind !== 'approve'}
              onClick={() => noteAction && decide.mutate({ kind: noteAction.kind, reservationId: noteAction.reservation.id, note })}
            >
              {noteAction ? t(`reservations.actions.${noteAction.kind}`) : ''}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </section>
  )
}
