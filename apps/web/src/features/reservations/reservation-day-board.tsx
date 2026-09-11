import { Loader, Text } from '@mantine/core'
import { ResourcesDayView, type ScheduleEventData, type ScheduleResourceData } from '@mantine/schedule'
import { useTranslation } from 'react-i18next'
import type { AmenitySummary } from '../locations/amenities-api'
import type { ReservationSummary } from './api'
import { reservationStatusKey } from './reservation-presentation'
import { WEEKDAY_KEYS } from './week'

/** Pill colours reused as block colours so the board reads like the pills. */
const EVENT_COLOR: Record<string, string> = {
  pending: 'warning',
  observed: 'warning',
  approved: 'teal',
  completed: 'gray',
}

/** Wall-clock `YYYY-MM-DD HH:mm:ss` in the location's calendar for a UTC instant. */
function localDateTime(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  // en-CA renders midnight as 24 in some engines.
  const hour = get('hour') === '24' ? '00' : get('hour')

  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')}`
}

/** The union of the amenities' windows on that weekday, as the board's visible span. */
function daySpan(amenities: AmenitySummary[], date: string): [string, string] {
  const weekday = WEEKDAY_KEYS[new Date(`${date}T12:00:00Z`).getUTCDay()]
  const windows = amenities.flatMap((amenity) => amenity.availability[weekday] ?? [])
  if (windows.length === 0) return ['08:00:00', '22:00:00']

  const start = windows.map((window) => window.start).sort()[0]
  const end = windows.map((window) => window.end).sort().at(-1)!

  return [`${start}:00`, end === '24:00' ? '23:59:59' : `${end}:00`]
}

/**
 * The reservations board: one row per reservable amenity, the day's
 * bookings as blocks, coloured by status. Two blocks in one row are a
 * conflict at a glance; that is the whole point of rows per amenity. The
 * board is read-only in practice: no drag, resize or slot handlers are
 * attached, so cells are inert and only blocks respond (static mode would
 * also drop the block click). Decisions happen in the drawer, new bookings
 * come from the Nueva reserva drawer. It scrolls sideways inside its own
 * card, never the page.
 */
export function ReservationDayBoard({
  amenities,
  date,
  loading = false,
  onSelect,
  reservations,
  timezone,
  today,
}: {
  amenities: AmenitySummary[]
  date: string
  loading?: boolean
  onSelect: (reservation: ReservationSummary) => void
  reservations: ReservationSummary[]
  timezone: string
  today: string
}) {
  const { t } = useTranslation('common')

  // Cancelled and rejected bookings hold nothing, so they leave the board.
  const shown = reservations.filter((reservation) => reservation.status !== 'cancelled' && reservation.status !== 'rejected')
  const reservable = amenities.filter((amenity) => amenity.is_reservable && amenity.status === 'active')
  // A booking on an amenity that has since been deactivated still needs a row.
  const extra = shown
    .filter((reservation) => !reservable.some((amenity) => amenity.id === reservation.amenity_id))
    .map((reservation) => ({ id: reservation.amenity_id, name: reservation.amenity_name }))
  const resources: ScheduleResourceData[] = [
    ...reservable.map((amenity) => ({ id: amenity.id, label: amenity.name })),
    ...extra.filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index).map((item) => ({ id: item.id, label: item.name })),
  ]
  const events: ScheduleEventData[] = shown.map((reservation) => ({
    id: reservation.id,
    title: [reservation.unit_number, reservation.resident_name].filter(Boolean).join(' · '),
    start: localDateTime(reservation.starts_at, timezone),
    end: localDateTime(reservation.ends_at, timezone),
    resourceId: reservation.amenity_id,
    color: EVENT_COLOR[reservationStatusKey(reservation)] ?? 'gray',
    variant: reservationStatusKey(reservation) === 'approved' ? 'filled' : 'light',
  }))
  const [startTime, endTime] = daySpan(reservable, date)
  const byId = new Map(shown.map((reservation) => [reservation.id, reservation]))

  return (
    <div className="wa-day-board overflow-hidden rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
      {loading ? (
        <div className="grid min-h-64 place-items-center">
          <Loader aria-label={t('common.loading')} />
        </div>
      ) : resources.length === 0 ? (
        <Text c="dimmed" className="px-5 py-10 text-center" size="sm">
          {t('reservations.board.noAmenities')}
        </Text>
      ) : (
        <ResourcesDayView
          date={date}
          endTime={endTime}
          events={events}
          intervalMinutes={60}
          locale="es"
          maxEventsPerTimeSlot={3}
          radius={0}
          resources={resources}
          rowHeight={56}
          slotWidth={72}
          startTime={startTime}
          withCurrentTimeIndicator={date === today}
          withHeader={false}
          onEventClick={(event) => {
            const reservation = byId.get(String(event.id))
            if (reservation) onSelect(reservation)
          }}
        />
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--mantine-color-default-border)] px-4 py-2.5 text-xs text-[var(--mantine-color-dimmed)]">
        <Legend color="var(--wa-interactive)" label={t('reservations.statuses.approved')} />
        <Legend color="var(--wa-warning)" label={t('reservations.statuses.pending')} />
        <Legend color="var(--wa-text-3)" label={t('reservations.statuses.completed')} />
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  )
}
