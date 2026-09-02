import { Badge, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import type { ReservationSummary } from './api'
import { formatTimeRange, localDateString, longDayLabel, shortDayLabel } from './week'

const ROW_GRID =
  'grid grid-cols-[1.2fr_0.6fr_0.9fr_0.6fr_100px_110px] items-center gap-3 px-4 py-3'

/**
 * Amenity accent bar colors cycle through the Puerto roles so neighboring
 * amenities read apart; the mapping is stable per amenity within a page.
 */
const ACCENTS = ['--wa-interactive', '--wa-accent', '--wa-info', '--wa-success']

function accentFor(amenityId: string, palette: Map<string, string>): string {
  if (!palette.has(amenityId)) {
    palette.set(amenityId, ACCENTS[palette.size % ACCENTS.length])
  }

  return palette.get(amenityId)!
}

function statusBadge(reservation: ReservationSummary) {
  if (reservation.is_completed) {
    return { color: 'gray', key: 'completed' }
  }

  const colors: Record<ReservationSummary['status'], string> = {
    pending: 'warning',
    approved: 'success',
    observed: 'info',
    rejected: 'error',
    cancelled: 'gray',
  }

  return { color: colors[reservation.status], key: reservation.status }
}

/**
 * The Lista view of mockup 08: one band per day that has reservations,
 * "Hoy"/"Mañana" prefixes, and table-like rows with a per-amenity accent
 * bar. A custom grid, not the shared DataTable — day-band grouping and the
 * accent column don't fit its column model.
 */
export function ReservationWeekList({
  onSelect,
  reservations,
  timezone,
  today,
}: {
  onSelect: (reservation: ReservationSummary) => void
  reservations: ReservationSummary[]
  timezone: string
  today: string
}) {
  const { t } = useTranslation('common')
  const palette = new Map<string, string>()

  const byDay = new Map<string, ReservationSummary[]>()
  for (const reservation of reservations) {
    const day = localDateString(new Date(reservation.starts_at), timezone)
    byDay.set(day, [...(byDay.get(day) ?? []), reservation])
  }
  const days = [...byDay.keys()].sort()

  return (
    <div className="overflow-hidden rounded-[14px] border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div
            className={`${ROW_GRID} border-b border-[var(--mantine-color-default-border)] py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-[var(--mantine-color-dimmed)]`}
          >
            <span>{t('reservations.columns.amenity')}</span>
            <span>{t('reservations.columns.unit')}</span>
            <span>{t('reservations.columns.resident')}</span>
            <span>{t('reservations.columns.date')}</span>
            <span>{t('reservations.columns.time')}</span>
            <span>{t('reservations.columns.status')}</span>
          </div>

          {days.length === 0 ? (
            <Text c="dimmed" className="px-5 py-8 text-center" size="sm">
              {t('reservations.emptyWeek')}
            </Text>
          ) : (
            days.map((day) => {
              const prefix =
                day === today
                  ? `${t('reservations.today')} · `
                  : day === nextDay(today)
                    ? `${t('reservations.tomorrow')} · `
                    : ''

              return (
                <div key={day}>
                  <div className="border-b border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--mantine-color-dimmed)]">
                    {prefix}
                    {longDayLabel(day)}
                  </div>
                  {byDay.get(day)!.map((reservation) => {
                    const badge = statusBadge(reservation)

                    return (
                      <div
                        key={reservation.id}
                        className={`${ROW_GRID} cursor-pointer border-b border-[var(--mantine-color-default-border)] text-[13.5px] transition-colors hover:bg-[var(--mantine-color-default-hover)]`}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(reservation)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onSelect(reservation)
                          }
                        }}
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className="h-[26px] w-[3px] shrink-0 rounded-full"
                            style={{ background: `var(${accentFor(reservation.amenity_id, palette)})` }}
                          />
                          <Text fw={600} size="sm" truncate>
                            {reservation.amenity_name}
                          </Text>
                        </span>
                        <Text c="dimmed" size="sm" truncate>
                          {reservation.unit_number}
                        </Text>
                        <Text c="dimmed" size="sm" truncate>
                          {reservation.resident_name ?? '—'}
                        </Text>
                        <Text c="dimmed" size="sm">
                          {shortDayLabel(day)}
                        </Text>
                        <Text c="dimmed" size="sm">
                          {formatTimeRange(reservation, timezone)}
                        </Text>
                        <Badge color={badge.color} radius="xl" size="sm" variant="light">
                          {t(`reservations.statuses.${badge.key}`)}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function nextDay(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + 1)

  return parsed.toISOString().slice(0, 10)
}
