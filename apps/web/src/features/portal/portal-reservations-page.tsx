import { ActionIcon, Button, Loader, Text } from '@mantine/core'
import { AddCircle } from '@solar-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet, ConfirmSheet, SheetAction, SheetNote, SheetTile, SheetTiles } from '../../components/ui/bottom-sheet'
import { DrawerTimeline, type TimelineItem } from '../../components/ui/detail-drawer-parts'
import { getErrorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { notifyError, notifySuccess } from '../../lib/notify'
import { useMe } from '../auth/hooks'
import { useActiveUnit } from './active-unit-context'
import { cancelPortalReservation, getPortalAmenities, getPortalReservation, getPortalReservations, type PortalAmenity, type PortalReservation } from './api'
import { PortalRow, StatusPill } from './portal-cards'
import { reservationLongRange, reservationRange, reservationTone } from './presentation'

const routeApi = getRouteApi('/_authenticated/portal/reservas')

/** Reservas (Portal 02/02b/02e): my bookings, the amenities I can book, and the booking detail sheet. */
export function PortalReservationsPage() {
  const { t } = useTranslation('common')
  const me = useMe().data
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  const { active } = useActiveUnit()
  const queryClient = useQueryClient()
  // An alert row arrives with ?reserva=; closing the sheet clears it so back doesn't reopen.
  const [pickedId, setPickedId] = useState<string | null>(null)
  const selectedId = pickedId ?? search.reserva ?? null
  const setSelectedId = (id: string | null) => {
    setPickedId(id)
    if (id === null && search.reserva) void navigate({ search: { chip: search.chip }, replace: true })
  }
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const timezone = me?.active_location?.timezone ?? 'America/Lima'
  const chip = search.chip

  const upcoming = useQuery({ queryKey: ['portal', 'reservations', active?.unit_id, 'upcoming'], queryFn: () => getPortalReservations(active!.unit_id, 'upcoming'), enabled: active !== null })
  const past = useQuery({ queryKey: ['portal', 'reservations', active?.unit_id, 'past'], queryFn: () => getPortalReservations(active!.unit_id, 'past'), enabled: active !== null && chip === 'mine' })
  const amenities = useQuery({ queryKey: ['portal', 'amenities', active?.unit_id], queryFn: () => getPortalAmenities(active!.unit_id), enabled: active !== null && chip === 'amenidades' })
  const detail = useQuery({ queryKey: ['portal', 'reservation', selectedId], queryFn: () => getPortalReservation(selectedId!), enabled: selectedId !== null })

  const cancel = useMutation({
    mutationFn: (id: string) => cancelPortalReservation(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portal', 'reservations'] })
      setConfirmingCancel(false)
      setSelectedId(null)
      notifySuccess(t('portal.reservations.cancelled'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  if (!active) {
    return (
      <Text c="dimmed" size="sm">
        {t('portal.noUnit')}
      </Text>
    )
  }

  const upcomingRows = upcoming.data?.data ?? []
  const pastRows = past.data?.data ?? []
  const selected = detail.data?.data ?? null

  function statusLabel(reservation: PortalReservation) {
    return t(`portal.reservations.status.${reservation.is_completed ? 'completed' : reservation.status}`)
  }

  const timeline: TimelineItem[] = (detail.data?.history ?? []).map((entry) => ({
    id: entry.id,
    when: entry.created_at ? new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(new Date(entry.created_at)).replace('.', '') : '',
    label: t(`portal.reservations.timeline.${entry.event_type.split('.')[1] ?? 'created'}`),
    actor: entry.actor_name ?? t('portal.reservations.timeline.staff'),
  }))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-2xl font-bold">{t('portal.tabs.reservations')}</h1>
        <Text c="dimmed" mt={4} size="sm">
          {active.unit_label}
        </Text>
      </div>

      <div className="flex gap-2" role="tablist">
        {(['mine', 'amenidades'] as const).map((key) => (
          <button
            key={key}
            aria-selected={chip === key}
            className={`min-h-9 cursor-pointer rounded-full border px-4 text-xs font-semibold ${chip === key ? 'border-[var(--wa-accent)] bg-[var(--wa-accent)] text-[#1c2b2c]' : 'border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] text-[var(--mantine-color-dimmed)]'}`}
            role="tab"
            type="button"
            onClick={() => void navigate({ search: { chip: key } })}
          >
            {key === 'mine' && upcoming.data ? `${t('portal.reservations.chips.mine')} · ${upcoming.data.meta.total}` : t(`portal.reservations.chips.${key}`)}
          </button>
        ))}
      </div>

      {chip === 'mine' ? (
        upcoming.isLoading ? (
          <div className="grid min-h-24 place-items-center">
            <Loader aria-label={t('common.loading')} />
          </div>
        ) : (
          <>
            {upcomingRows.length === 0 ? (
              <Text c="dimmed" className="py-4 text-center" size="sm">
                {t('portal.reservations.emptyUpcoming')}
              </Text>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {upcomingRows.map((reservation) => (
                  <PortalRow key={reservation.id} pill={<StatusPill color={reservationTone(reservation.status)}>{statusLabel(reservation)}</StatusPill>} primary={reservation.amenity_name ?? ''} secondary={reservationRange(reservation.starts_at, reservation.ends_at, timezone)} onClick={() => setSelectedId(reservation.id)} />
                ))}
              </ul>
            )}
            {pastRows.length > 0 ? (
              <div className="flex flex-col gap-2 opacity-70">
                <h2 className="m-0 text-[11px] font-bold uppercase tracking-widest text-[var(--wa-text-3)]">{t('portal.reservations.past')}</h2>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {pastRows.map((reservation) => (
                    <PortalRow key={reservation.id} pill={<StatusPill color={reservationTone(reservation.status, reservation.is_completed)}>{statusLabel(reservation)}</StatusPill>} primary={reservation.amenity_name ?? ''} secondary={reservationRange(reservation.starts_at, reservation.ends_at, timezone)} onClick={() => setSelectedId(reservation.id)} />
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )
      ) : amenities.isLoading ? (
        <div className="grid min-h-24 place-items-center">
          <Loader aria-label={t('common.loading')} />
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {(amenities.data?.data ?? []).map((amenity) => (
            <AmenityCard key={amenity.id} amenity={amenity} />
          ))}
          {amenities.data && amenities.data.data.length === 0 ? (
            <Text c="dimmed" className="py-4 text-center" size="sm">
              {t('portal.reservations.noAmenities')}
            </Text>
          ) : null}
        </ul>
      )}

      {chip === 'mine' ? (
        <ActionIcon aria-label={t('portal.reservations.book')} className="fixed right-5 bottom-20 shadow-lg" color="accent" radius="xl" size={56} variant="filled" onClick={() => void navigate({ search: { chip: 'amenidades' } })}>
          <AddCircle size={26} />
        </ActionIcon>
      ) : null}

      <BottomSheet
        footer={
          selected && ['pending', 'observed', 'approved'].includes(selected.status) && !selected.is_completed ? (
            <SheetAction
              hint={
                detail.data?.can_cancel
                  ? detail.data.cancellation_window_hours
                    ? t('portal.reservations.cancelWindow', { hours: detail.data.cancellation_window_hours })
                    : t('portal.reservations.cancelAnytime')
                  : t('portal.reservations.cancelClosed')
              }
            >
              <Button className="w-full" color="error" disabled={!detail.data?.can_cancel} variant="default" onClick={() => setConfirmingCancel(true)}>
                {t('portal.reservations.cancel')}
              </Button>
            </SheetAction>
          ) : undefined
        }
        lines={selected ? [reservationLongRange(selected.starts_at, selected.ends_at, timezone), active.unit_label] : []}
        footerDivider
        opened={selectedId !== null}
        pill={selected ? <StatusPill color={reservationTone(selected.status, selected.is_completed)}>{statusLabel(selected)}</StatusPill> : undefined}
        title={selected?.amenity_name ?? ''}
        onClose={() => setSelectedId(null)}
      >
        {selected ? (
          <div className="flex flex-col gap-2.5">
            <SheetTiles>
              <SheetTile label={t('portal.reservations.fee')} value={selected.fee_snapshot ? formatMoney(selected.fee_snapshot) : t('portal.reservations.free')} />
              <SheetTile label={t('portal.reservations.deposit')} value={selected.deposit_snapshot ? formatMoney(selected.deposit_snapshot) : '—'} />
              <SheetTile label={t('portal.reservations.requestedBy')} value={selected.resident_name ?? selected.created_by_name ?? '—'} wide />
            </SheetTiles>
            {selected.status_note ? <SheetNote label={t('portal.reservations.staffNote')}>{selected.status_note}</SheetNote> : null}
            <DrawerTimeline items={timeline} />
          </div>
        ) : (
          <div className="grid min-h-24 place-items-center">
            <Loader aria-label={t('common.loading')} />
          </div>
        )}
      </BottomSheet>

      <ConfirmSheet
        body={t('portal.reservations.cancelBody')}
        confirmLabel={t('portal.reservations.cancel')}
        opened={confirmingCancel}
        pending={cancel.isPending}
        title={t('portal.reservations.cancelTitle', { amenity: selected?.amenity_name ?? '' })}
        onCancel={() => setConfirmingCancel(false)}
        onConfirm={() => selected && cancel.mutate(selected.id)}
      />
    </div>
  )
}

function AmenityCard({ amenity }: { amenity: PortalAmenity }) {
  const { t } = useTranslation('common')
  const facts = [
    amenity.capacity ? t('portal.reservations.upTo', { count: amenity.capacity }) : null,
    amenity.fee_amount ? formatMoney(amenity.fee_amount) : t('portal.reservations.free'),
    amenity.deposit_amount ? t('portal.reservations.depositOf', { amount: formatMoney(amenity.deposit_amount) }) : null,
  ].filter(Boolean)

  return (
    <li>
      <Link className="block overflow-hidden rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] no-underline" params={{ amenityId: amenity.id }} to="/portal/reservas/amenidades/$amenityId">
        <div className="relative h-[120px] bg-[var(--wa-surface-2)]">
          {amenity.cover_photo_url ? <img alt="" className="h-full w-full object-cover" src={amenity.cover_photo_url} /> : null}
          <span className="absolute top-2.5 left-2.5">
            <StatusPill color={amenity.booking_mode === 'instant' ? 'teal' : 'warning'}>{t(`portal.reservations.mode.${amenity.booking_mode}`)}</StatusPill>
          </span>
        </div>
        <div className="flex flex-col gap-0.5 px-4 py-3 text-[var(--mantine-color-text)]">
          <span className="font-display text-[15px] font-semibold">{amenity.name}</span>
          {amenity.description ? <span className="truncate text-sm text-[var(--mantine-color-dimmed)]">{amenity.description}</span> : null}
          <span className="text-xs text-[var(--mantine-color-dimmed)]">{facts.join(' · ')}</span>
        </div>
      </Link>
    </li>
  )
}
