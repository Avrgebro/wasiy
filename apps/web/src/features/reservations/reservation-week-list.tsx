import { ReservationStatusBadge } from './reservation-status-badge'
import { TableEmptyState } from '../../components/table/table-empty-state'
import type { ReactNode } from 'react'
import { Loader, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import type { ReservationSummary } from './api'
import { formatTimeRange, localDateString, longDayLabel } from './week'

const ROW_GRID =
  'grid grid-cols-[1.2fr_0.6fr_0.9fr_100px_110px] items-center gap-3 px-4 py-3'

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

/**
 * The Lista view of mockup 08: one band per day that has reservations,
 * "Hoy"/"Mañana" prefixes, and table-like rows with a per-amenity accent
 * bar. A custom grid, not the shared DataTable — day-band grouping and the
 * accent column don't fit its column model.
 */
export function ReservationWeekList({
  toolbar,
  loading = false,
  fetching = false,
  onSelect,
  reservations,
  timezone,
  today,
}: {
  toolbar?: ReactNode
  loading?: boolean
  fetching?: boolean
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
    <div className="overflow-hidden rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
      {toolbar ? <div className="border-b border-[var(--mantine-color-default-border)]">{toolbar}</div> : null}
      {loading ? <div className="grid min-h-64 place-items-center"><Loader aria-label={t('common.loading')} /></div> : days.length === 0 ? <TableEmptyState /> : <div className={`overflow-x-auto ${fetching ? 'opacity-60' : ''}`}>
        <div className="min-w-[640px]">
          <div
            className={`${ROW_GRID} border-b border-[var(--mantine-color-default-border)] py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-[var(--mantine-color-dimmed)]`}
          >
            <span>{t('reservations.columns.amenity')}</span>
            <span>{t('reservations.columns.unit')}</span>
            <span>{t('reservations.columns.resident')}</span>
            <span>{t('reservations.columns.time')}</span>
            <span>{t('reservations.columns.status')}</span>
          </div>

          {days.map((day) => {
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
                          {formatTimeRange(reservation, timezone)}
                        </Text>
                        <ReservationStatusBadge reservation={reservation} />
                      </div>
                    )
                  })}
                </div>
              )
            })}
        </div>
      </div>}
    </div>
  )
}

function nextDay(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + 1)

  return parsed.toISOString().slice(0, 10)
}
