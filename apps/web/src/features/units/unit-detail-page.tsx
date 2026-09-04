import { Alert, Badge, Button, Skeleton, Text, Textarea } from '@mantine/core'
import { KeySquare } from '@solar-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../app/api-client'
import { formatDate } from '../../lib/dates'
import { getErrorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { notifyError, notifySuccess } from '../../lib/notify'
import { useMe } from '../auth/hooks'
import type { MovementSummary } from '../finances/api'
import { monthLabel, shortDate } from '../finances/month'
import { amountClassName, statusColor, statusLabel } from '../finances/movement-presentation'
import type { ReservationSummary } from '../reservations/api'
import { formatTimeRange, localDateString, shortDayLabel } from '../reservations/week'
import type { VehicleSummary } from '../vehicles/api'
import { addUnitNote, getUnit, type UnitMember, type UnitNote } from './api'
import { occupancyColor, portalColor, typeLabel } from './unit-presentation'

const routeApi = getRouteApi('/_authenticated/admin/registry/units_/$unitId')

/** The list's URL contract has defaults for every key; a bare link must spell them out. */
const UNITS_LIST_SEARCH = { page: 1, search: '', sort: '', type: '', status: '', chip: undefined } as const

export function UnitDetailPage() {
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

  return <UnitDetailContent timezone={location?.timezone ?? 'America/Lima'} />
}

function UnitDetailContent({ timezone }: { timezone: string }) {
  const { t } = useTranslation('common')
  const { unitId } = routeApi.useParams()

  const detailQuery = useQuery({
    queryKey: ['registry', 'units', 'detail', unitId],
    queryFn: () => getUnit(unitId),
    retry: false,
  })

  if (detailQuery.isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton height={160} radius="lg" />
        <Skeleton height={320} radius="lg" />
      </div>
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    const notFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404

    return (
      <div className="grid min-h-96 place-items-center text-center">
        <div className="flex flex-col items-center gap-2">
          <KeySquare className="text-[var(--mantine-color-dimmed)]" size={30} />
          <Text fw={700}>{notFound ? t('units.detail.notFoundTitle') : t('errors.loadFailed')}</Text>
          <Text c="dimmed" size="sm">
            {notFound ? t('units.detail.notFoundBody') : getErrorMessage(detailQuery.error)}
          </Text>
          <Link className="mt-1 font-semibold text-[var(--wa-interactive)] no-underline" search={UNITS_LIST_SEARCH}
            to="/admin/registry/units">
            {t('units.detail.backToList')}
          </Link>
        </div>
      </div>
    )
  }

  const { data: unit, reservations, movements, movements_month: month, pending_balance: balance, notes } = detailQuery.data
  const title = t('units.detail.title', { type: typeLabel(unit.type, t, true), number: unit.unit_number })
  const descriptor = [
    unit.building_name,
    unit.floor ? t('units.floorN', { floor: unit.floor }) : null,
    typeLabel(unit.type, t),
    unit.area_m2 !== null ? `${unit.area_m2} m²` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="@container flex flex-col gap-5">
      <nav className="flex items-center gap-2 text-[13.5px] text-[var(--mantine-color-dimmed)]">
        <Link className="text-[var(--wa-interactive)] no-underline" search={UNITS_LIST_SEARCH}
            to="/admin/registry/units">
          {t('units.title')}
        </Link>
        <span>/</span>
        <span className="font-semibold text-[var(--mantine-color-text)]">{title}</span>
      </nav>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="grid size-14 shrink-0 place-items-center rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] font-display text-lg font-semibold text-[var(--wa-interactive)]">
            {unit.unit_number}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="m-0 font-display text-2xl font-semibold tracking-tight text-[var(--mantine-color-text)]">{title}</h1>
              <Badge color={occupancyColor(unit.occupancy)} radius="xl" size="sm" variant="light">
                {t(`units.occupancy.${unit.occupancy}`)}
              </Badge>
              {unit.portal_state ? (
                <Badge color={portalColor(unit.portal_state)} radius="xl" size="sm" variant="light">
                  {t(`units.portal.${unit.portal_state}`)}
                </Badge>
              ) : null}
              {unit.status === 'inactive' ? (
                <Badge color="gray" radius="xl" size="sm" variant="light">
                  {t('units.statuses.inactive')}
                </Badge>
              ) : null}
            </div>
            <Text c="dimmed" mt={4} size="sm">
              {descriptor}
            </Text>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
              <Fact label={t('units.detail.monthlyFee')} value={unit.maintenance_fee !== null ? formatMoney(unit.maintenance_fee) : '—'} />
              <Fact label={t('units.detail.share')} value={unit.participation_share !== null ? `${unit.participation_share} %` : '—'} />
              <Fact label={t('units.detail.parking')} value={unit.parking_spots.join(', ') || '—'} />
              <Fact label={t('units.detail.storage')} value={unit.storage_rooms.join(', ') || '—'} />
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-4 @4xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title={`${t('units.detail.residents')} · ${unit.members.length}`}>
            {unit.members.length === 0 ? (
              <Empty title={t('units.detail.noResidentsTitle')} body={t('units.detail.noResidentsBody')} />
            ) : (
              unit.members.map((member) => <MemberRow key={member.membership_id} member={member} />)
            )}
          </Section>

          <Section
            action={
              <Link className="text-[13px] font-medium text-[var(--wa-interactive)] no-underline hover:underline" search={{}} to="/admin/reservations">
                {t('units.detail.seeAll')}
              </Link>
            }
            title={t('units.detail.reservations')}
          >
            {reservations.length === 0 ? (
              <Empty body={t('units.detail.noReservations')} />
            ) : (
              reservations.map((reservation) => <ReservationRow key={reservation.id} reservation={reservation} timezone={timezone} />)
            )}
          </Section>

          <Section
            action={
              <Link
                className="text-[13px] font-medium text-[var(--wa-interactive)] no-underline hover:underline"
                search={{ month, chip: undefined, search: '', category: '', sort: '', page: 1, movement: undefined }}
                to="/admin/finances"
              >
                {t('units.detail.viewInFinances')}
              </Link>
            }
            footer={
              <Text c={balance > 0 ? 'warning' : 'dimmed'} fw={balance > 0 ? 600 : 400} size="sm">
                {balance > 0 ? t('units.detail.pendingBalance', { amount: formatMoney(balance) }) : t('units.detail.noPendingBalance')}
              </Text>
            }
            title={`${t('units.detail.charges')} · ${monthLabel(month)}`}
          >
            {movements.length === 0 ? (
              <Empty body={t('units.detail.noMovements')} />
            ) : (
              movements.map((movement) => <MovementRow key={movement.id} movement={movement} />)
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Section title={`${t('units.detail.vehicles')} · ${unit.vehicles.length}`}>
            {unit.vehicles.length === 0 ? (
              <Empty body={t('units.detail.noVehicles')} />
            ) : (
              unit.vehicles.map((vehicle) => <VehicleRow key={vehicle.id} vehicle={vehicle} />)
            )}
          </Section>

          <Section title={t('units.detail.portal')}>
            {unit.members.filter((member) => member.portal_state === 'active').length === 0 ? (
              <Empty body={t('units.detail.noPortal')} />
            ) : (
              unit.members
                .filter((member) => member.portal_state === 'active')
                .map((member) => (
                  <div key={member.membership_id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <Text size="sm">{member.name}</Text>
                    <Badge color="success" radius="xl" size="sm" variant="light">
                      {t('registry.portal.enabled')}
                    </Badge>
                  </div>
                ))
            )}
          </Section>

          <NotesSection notes={notes} unitId={unit.id} />
        </div>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[132px] rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] px-3.5 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mantine-color-dimmed)]">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  )
}

function Section({ action, children, footer, title }: { action?: ReactNode; children: ReactNode; footer?: ReactNode; title: string }) {
  return (
    <section className="overflow-hidden rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <h2 className="m-0 font-display text-base font-semibold">{title}</h2>
        {action}
      </div>
      <div className="divide-y divide-[var(--mantine-color-default-border)] border-t border-[var(--mantine-color-default-border)]">{children}</div>
      {footer ? <div className="border-t border-[var(--mantine-color-default-border)] px-5 py-3">{footer}</div> : null}
    </section>
  )
}

function Empty({ body, title }: { body: string; title?: string }) {
  return (
    <div className="px-5 py-6 text-center">
      {title ? <Text fw={600} size="sm">{title}</Text> : null}
      <Text c="dimmed" size="sm">
        {body}
      </Text>
    </div>
  )
}

function monogram(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function MemberRow({ member }: { member: UnitMember }) {
  const { t } = useTranslation('common')

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--wa-secondary)] text-xs font-semibold text-[#F7F5F0]">
        {monogram(member.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Text fw={600} size="sm">
            {member.name}
          </Text>
          {member.is_primary_contact ? (
            <Badge color="accent" radius="xl" size="xs" variant="light">
              {t('units.detail.primaryContact')}
            </Badge>
          ) : null}
          <span className="rounded-full border border-[var(--mantine-color-default-border)] px-2 py-px text-[11px] font-medium text-[var(--mantine-color-dimmed)]">
            {t(`units.roles.${member.resident_type}`)}
          </span>
        </div>
        <Text c="dimmed" className="truncate" size="xs">
          {[member.email, member.phone].filter(Boolean).join(' · ') || '—'}
        </Text>
      </div>
      <Badge color={portalColor(member.portal_state)} radius="xl" size="sm" variant="light">
        {t(`units.portal.${member.portal_state}`)}
      </Badge>
    </div>
  )
}

function ReservationRow({ reservation, timezone }: { reservation: ReservationSummary; timezone: string }) {
  const { t } = useTranslation('common')
  const charges = [
    reservation.fee_snapshot ? t('reservations.queue.fee', { amount: reservation.fee_snapshot }) : null,
    reservation.deposit_snapshot ? t('reservations.queue.deposit', { amount: reservation.deposit_snapshot }) : null,
  ].filter(Boolean)

  return (
    <div className="flex items-center gap-3.5 px-5 py-3">
      <span className="w-24 shrink-0 font-mono text-xs text-[var(--mantine-color-dimmed)]">
        {shortDayLabel(localDateString(new Date(reservation.starts_at), timezone))} · {formatTimeRange(reservation, timezone).split('–')[0]}
      </span>
      <div className="min-w-0 flex-1">
        <Text fw={600} size="sm">
          {reservation.amenity_name}
        </Text>
        <Text c="dimmed" size="xs">
          {[reservation.resident_name ? t('units.detail.bookedBy', { name: reservation.resident_name }) : null, charges.length ? charges.join(' + ') : t('reservations.queue.free')]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </div>
      <Badge color={reservation.status === 'approved' ? 'success' : reservation.status === 'observed' ? 'info' : 'warning'} radius="xl" size="sm" variant="light">
        {t(`reservations.statuses.${reservation.status}`)}
      </Badge>
    </div>
  )
}

function MovementRow({ movement }: { movement: MovementSummary }) {
  const { t } = useTranslation('common')

  return (
    <div className="flex items-center gap-3.5 px-5 py-3">
      <div className="min-w-0 flex-1">
        <Text fw={600} size="sm">
          {movement.concept}
        </Text>
        <Text c="dimmed" size="xs">
          {movement.detail ?? shortDate(movement.occurred_on)}
        </Text>
      </div>
      <span className={`font-mono text-sm font-semibold ${amountClassName(movement)}`}>
        {formatMoney(movement.amount, { negative: movement.direction === 'expense' })}
      </span>
      <Badge color={statusColor(movement.status)} radius="xl" size="sm" variant="light">
        {statusLabel(movement, t)}
      </Badge>
    </div>
  )
}

function VehicleRow({ vehicle }: { vehicle: VehicleSummary }) {
  const { t } = useTranslation('common')
  const inactive = vehicle.status === 'inactive'

  return (
    <div className={`flex items-center gap-3.5 px-5 py-3 ${inactive ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold">{vehicle.plate ?? t(`registry.vehicleTypes.${vehicle.vehicle_type}`)}</span>
          {inactive ? (
            <Badge color="gray" radius="xl" size="xs" variant="light">
              {t('registry.statuses.inactive')}
            </Badge>
          ) : null}
        </div>
        <Text c="dimmed" size="xs">
          {[[vehicle.make, vehicle.model].filter(Boolean).join(' '), vehicle.color].filter(Boolean).join(' · ') || t(`registry.vehicleTypes.${vehicle.vehicle_type}`)}
        </Text>
      </div>
    </div>
  )
}

function NotesSection({ notes, unitId }: { notes: UnitNote[]; unitId: string }) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [writing, setWriting] = useState(false)
  const [body, setBody] = useState('')

  const mutation = useMutation({
    mutationFn: () => addUnitNote(unitId, body.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['registry', 'units', 'detail', unitId] })
      setBody('')
      setWriting(false)
      notifySuccess(t('units.detail.noteAdded'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  return (
    <Section
      action={
        !writing ? (
          <button
            className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-[var(--wa-interactive)] pointer-coarse:min-h-11"
            type="button"
            onClick={() => setWriting(true)}
          >
            {t('units.detail.addNote')}
          </button>
        ) : null
      }
      footer={
        <Text c="dimmed" size="xs">
          {t('units.detail.notesHint')}
        </Text>
      }
      title={t('units.detail.notes')}
    >
      {writing ? (
        <div className="flex flex-col gap-2.5 px-5 py-3.5">
          <Textarea
            aria-label={t('units.detail.notes')}
            autoFocus
            placeholder={t('units.detail.notePlaceholder')}
            rows={3}
            value={body}
            onChange={(event) => setBody(event.currentTarget.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={() => { setWriting(false); setBody('') }}>
              {t('actions.cancel')}
            </Button>
            <Button color="accent" disabled={body.trim().length === 0} loading={mutation.isPending} onClick={() => mutation.mutate()}>
              {t('units.detail.saveNote')}
            </Button>
          </div>
        </div>
      ) : null}
      {notes.length === 0 && !writing ? (
        <Empty body={t('units.detail.noNotes')} />
      ) : (
        notes.map((note) => (
          <div key={note.id} className="px-5 py-3">
            <Text size="sm">{note.body}</Text>
            <Text c="dimmed" mt={2} size="xs">
              {[note.author_name, note.created_at ? formatDate(note.created_at) : null].filter(Boolean).join(' · ')}
            </Text>
          </div>
        ))
      )}
    </Section>
  )
}
