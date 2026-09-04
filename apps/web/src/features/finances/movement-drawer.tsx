import { Badge, Button, Skeleton, Text, Textarea } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { getErrorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { notifyError, notifySuccess } from '../../lib/notify'
import { localDateString } from '../reservations/week'
import {
  getMovement,
  transitionMovement,
  type MovementHistoryEntry,
  type MovementStatus,
  type MovementSummary,
} from './api'
import { longDate, shortDateTime } from './month'
import {
  amountClassName,
  primaryTransition,
  statusColor,
  statusLabel,
  transitionLabel,
} from './movement-presentation'

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
                {formatMoney(movement.amount, { negative: movement.direction === 'expense' })}
              </span>
              <Badge color={statusColor(movement.status)} radius="xl" size="md" variant="light">
                {statusLabel(movement, t)}
              </Badge>
            </div>

            <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-4">
              <Fact label={t('finances.columns.date')} value={longDate(movement.occurred_on)} />
              {movement.due_on ? (
                <Fact label={t('finances.detail.dueOn')} value={longDate(movement.due_on)} />
              ) : null}
              <Fact
                label={t(movement.unit_number ? 'finances.columns.unit' : 'finances.form.counterparty')}
                value={movement.unit_number ?? movement.counterparty ?? '—'}
              />
              {movement.reservation ? (
                <Fact
                  label={t('finances.detail.reservation')}
                  value={
                    <Link
                      className="text-[var(--wa-info)] no-underline hover:underline"
                      search={{ date: localDateString(new Date(movement.reservation.starts_at), timezone) }}
                      to="/admin/reservations"
                    >
                      {movement.reservation.amenity_name} ·{' '}
                      {shortDateTime(movement.reservation.starts_at, timezone)} →
                    </Link>
                  }
                />
              ) : null}
              <Fact
                label={t('finances.detail.recordedBy')}
                value={
                  movement.reservation_id
                    ? t('finances.detail.recordedBySystem')
                    : (movement.created_by_name ?? '—')
                }
              />
              {movement.note ? (
                <div className="col-span-2">
                  <Fact label={t('finances.detail.note')} value={movement.note} />
                </div>
              ) : null}
            </dl>

            <SectionRule label={t('finances.history.title')} />
            <ol className="m-0 flex list-none flex-col p-0">
              {history.map((entry, index) => (
                <HistoryItem
                  key={entry.id}
                  entry={entry}
                  fromReservation={movement.reservation_id !== null}
                  last={index === history.length - 1}
                  timezone={timezone}
                />
              ))}
            </ol>

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

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mantine-color-dimmed)]">
        {label}
      </dt>
      <dd className="m-0 text-sm leading-normal">{value}</dd>
    </div>
  )
}

function SectionRule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--wa-info)]">{label}</span>
      <span className="h-px flex-1 bg-[var(--mantine-color-default-border)]" />
    </div>
  )
}

function historyLabel(entry: MovementHistoryEntry, fromReservation: boolean, t: (key: string) => string) {
  if (entry.event_type === 'movement.recorded') {
    return t(fromReservation ? 'finances.history.generatedOnApproval' : 'finances.history.recorded')
  }

  return t(`finances.history.${entry.status ?? 'pending'}`)
}

function HistoryItem({
  entry,
  fromReservation,
  last,
  timezone,
}: {
  entry: MovementHistoryEntry
  fromReservation: boolean
  last: boolean
  timezone: string
}) {
  const { t } = useTranslation('common')
  const system = entry.event_type === 'movement.recorded' && fromReservation

  return (
    <li className="flex gap-3">
      <div className="flex shrink-0 flex-col items-center pt-1">
        <span
          className={`size-2 rounded-full ${last ? 'bg-[var(--mantine-color-default-border)]' : 'bg-[var(--wa-info)]'}`}
        />
        {!last ? <span className="mt-1 -mb-1 w-px flex-1 bg-[var(--mantine-color-default-border)]" /> : null}
      </div>
      <div className={last ? '' : 'pb-3.5'}>
        <div className="font-mono text-xs text-[var(--mantine-color-dimmed)]">
          {entry.created_at ? shortDateTime(entry.created_at, timezone) : '—'}
        </div>
        <div className="mt-0.5 text-[13px] font-medium">{historyLabel(entry, fromReservation, t)}</div>
        <div className="text-xs text-[var(--mantine-color-dimmed)]">
          {system ? t('finances.history.system') : (entry.actor_name ?? '—')}
        </div>
      </div>
    </li>
  )
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
  const primary = primaryTransition(movement)
  const destructive = movement.allowed_transitions.filter((status) => DESTRUCTIVE.includes(status))
  const reverts = movement.allowed_transitions.filter(
    (status) => status !== primary && !DESTRUCTIVE.includes(status),
  )

  return (
    <>
      <SectionRule label={t('finances.detail.actions')} />
      <Textarea
        label={t('finances.detail.actionNote')}
        placeholder={t('finances.detail.actionNoteHint')}
        rows={2}
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
              onClick={() => onTransition(status)}
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
            size="compact-sm"
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
