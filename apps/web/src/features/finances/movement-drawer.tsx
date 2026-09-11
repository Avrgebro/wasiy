import { Button, Skeleton, Text, Textarea } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import {
  ConfirmDialog,
  DrawerFact,
  DrawerFacts,
  DrawerSection,
  DrawerTimeline,
} from '../../components/ui/detail-drawer-parts'
import { getErrorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { notifyError, notifySuccess } from '../../lib/notify'
import { localDateString } from '../reservations/week'
import { getMovement, transitionMovement, type MovementHistoryEntry, type MovementStatus, type MovementSummary } from './api'
import { longDate, shortDateTime } from './month'
import {
  amountClassName,
  primaryTransition,
  statusColor,
  statusLabel,
  transitionLabel,
} from './movement-presentation'
import { StatusPill } from '../../components/ui/chips'

const DESTRUCTIVE: MovementStatus[] = ['voided', 'retained']

/**
 * The row's home (mockup 10 drawer): amount and status, the facts the table
 * omits, the history from the activity log, and every allowed transition —
 * forward move as primary, void/retain as secondary, reverts as a text link.
 * One optional note applies to whichever action is pressed.
 */
export function MovementDrawer({
  accountId,
  movementId,
  onClose,
  timezone,
}: {
  accountId: string
  movementId: string | null
  onClose: () => void
  timezone: string
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  // The drawer overlays the page, so a row change always goes through
  // close: resetting the note there covers every path.
  const [note, setNote] = useState('')
  const close = () => {
    setNote('')
    onClose()
  }

  const detailQuery = useQuery({
    enabled: movementId !== null,
    queryKey: ['finances', 'movement', accountId, movementId],
    queryFn: () => getMovement(accountId, movementId!),
  })

  const mutation = useMutation({
    mutationFn: (status: MovementStatus) =>
      transitionMovement(accountId, movementId!, status, note.trim() || undefined),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['finances'] }),
        queryClient.invalidateQueries({ queryKey: ['reservations'] }),
      ])
      setNote('')
      notifySuccess(t('finances.updated'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  const movement = detailQuery.data?.data
  const history = detailQuery.data?.history ?? []

  return (
    <AppDrawer
      opened={movementId !== null}
      subtitle={
        movement
          ? `${t(`finances.form.${movement.direction}`)} · ${t(`finances.categories.${movement.category}`)}`
          : undefined
      }
      title={movement?.concept ?? t('finances.detail.open')}
      onClose={close}
    >
      <AppDrawerBody>
        {detailQuery.isError ? (
          <Text c="error">{getErrorMessage(detailQuery.error)}</Text>
        ) : !movement ? (
          <Skeleton height={240} radius="md" />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className={`text-[34px] font-semibold tracking-tight ${amountClassName(movement)}`}>
                {formatMoney(movement.amount_minor, { negative: movement.direction === 'expense' })}
              </span>
              <StatusPill color={statusColor(movement.status)}>
                {statusLabel(movement, t)}
              </StatusPill>
            </div>

            <DrawerFacts>
              <DrawerFact label={t('finances.columns.date')} value={longDate(movement.occurred_on)} />
              {movement.due_on ? (
                <DrawerFact label={t('finances.detail.dueOn')} value={longDate(movement.due_on)} />
              ) : null}
              <DrawerFact
                label={t(movement.unit_number ? 'finances.columns.unit' : 'finances.form.counterparty')}
                value={
                  movement.unit_id && movement.unit_number ? (
                    <Link
                      className="text-[var(--wa-interactive)] no-underline hover:underline"
                      params={{ unitId: movement.unit_id }}
                      to="/admin/units/$unitId"
                    >
                      {movement.unit_number} →
                    </Link>
                  ) : (
                    (movement.counterparty ?? '—')
                  )
                }
              />
              {movement.reservation ? (
                <DrawerFact
                  label={t('finances.detail.reservation')}
                  value={
                    <Link
                      className="text-[var(--wa-info)] no-underline hover:underline"
                      search={{
                        date: localDateString(new Date(movement.reservation.starts_at), timezone),
                        reservation: movement.reservation.id,
                      }}
                      to="/admin/reservations"
                    >
                      {movement.reservation.amenity_name} ·{' '}
                      {shortDateTime(movement.reservation.starts_at, timezone)} →
                    </Link>
                  }
                />
              ) : null}
              <DrawerFact
                label={t('finances.detail.recordedBy')}
                value={
                  movement.reservation_id
                    ? t('finances.detail.recordedBySystem')
                    : (movement.created_by_name ?? '—')
                }
              />
              {movement.note ? (
                <DrawerFact wide label={t('finances.detail.note')} value={movement.note} />
              ) : null}
            </DrawerFacts>

            <DrawerSection label={t('finances.history.title')} />
            <DrawerTimeline
              items={history.map((entry) => ({
                id: entry.id,
                when: entry.created_at ? shortDateTime(entry.created_at, timezone) : '—',
                label: historyLabel(entry, movement.reservation_id !== null, t),
                actor:
                  entry.event_type === 'movement.recorded' && movement.reservation_id !== null
                    ? t('finances.history.system')
                    : (entry.actor_name ?? '—'),
              }))}
            />

            {movement.allowed_transitions.length > 0 ? (
              <Actions
                loading={mutation.isPending}
                movement={movement}
                note={note}
                onNote={setNote}
                onTransition={(status) => mutation.mutate(status)}
              />
            ) : null}
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

function historyLabel(entry: MovementHistoryEntry, fromReservation: boolean, t: (key: string) => string) {
  if (entry.event_type === 'movement.recorded') {
    return t(fromReservation ? 'finances.history.generatedOnApproval' : 'finances.history.recorded')
  }

  return t(`finances.history.${entry.status ?? 'pending'}`)
}

function Actions({
  loading,
  movement,
  note,
  onNote,
  onTransition,
}: {
  loading: boolean
  movement: MovementSummary
  note: string
  onNote: (value: string) => void
  onTransition: (status: MovementStatus) => void
}) {
  const { t } = useTranslation('common')
  const [confirming, setConfirming] = useState<MovementStatus | null>(null)
  const primary = primaryTransition(movement)
  const destructive = movement.allowed_transitions.filter((status) => DESTRUCTIVE.includes(status))
  const reverts = movement.allowed_transitions.filter(
    (status) => status !== primary && !DESTRUCTIVE.includes(status),
  )

  return (
    <>
      {/* The two moves people regret ask once; paid/refunded stay one click. */}
      <ConfirmDialog
        body={t(confirming === 'voided' ? 'finances.detail.confirmVoidBody' : 'finances.detail.confirmRetainBody')}
        opened={confirming !== null}
        title={t(confirming === 'voided' ? 'finances.detail.confirmVoid' : 'finances.detail.confirmRetain')}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) {
            onTransition(confirming)
          }
          setConfirming(null)
        }}
      />
      <DrawerSection label={t('finances.detail.actions')} />
      <Textarea
        label={t('finances.detail.actionNote')}
        placeholder={t('finances.detail.actionNoteHint')}
        rows={3}
        value={note}
        onChange={(event) => onNote(event.currentTarget.value)}
      />
      <div className="flex flex-col items-start gap-2.5">
        <div className="flex w-full gap-2.5">
          {primary ? (
            <Button className="flex-1" color="accent" loading={loading} onClick={() => onTransition(primary)}>
              {transitionLabel(primary, t)}
            </Button>
          ) : null}
          {destructive.map((status) => (
            <Button
              key={status}
              className="flex-1"
              disabled={loading}
              variant="default"
              onClick={() => setConfirming(status)}
            >
              {transitionLabel(status, t)}
            </Button>
          ))}
        </div>
        {reverts.map((status) => (
          <Button
            key={status}
            c="dimmed"
            disabled={loading}
            size="sm"
            variant="subtle"
            onClick={() => onTransition(status)}
          >
            {transitionLabel(status, t)}
          </Button>
        ))}
      </div>
    </>
  )
}
