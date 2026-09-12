import type { ColumnDef } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '../../components/table/data-table'
import { openRowColumn } from '../../components/table/open-row-column'
import type { ReservationSummary } from './api'
import { ReservationStatusBadge } from './reservation-status-badge'
import { addDays, dayHeading } from './week'

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
 * The Lista view of mockup 08 on the day model (ADR 0043), on the shared
 * DataTable: one band per day that has bookings ("Hoy · viernes 12 de
 * septiembre" via groupBy — the API returns the week ordered by day), rows of
 * amenity with its accent bar, unit, resident (from md) and status, the
 * trailing chevron, and the row opens the drawer. Bookings carry no time.
 */
export function ReservationWeekList({
  toolbar,
  loading = false,
  fetching = false,
  onSelect,
  reservations,
  selectedId = null,
  today,
}: {
  toolbar?: ReactNode
  loading?: boolean
  fetching?: boolean
  onSelect: (reservation: ReservationSummary) => void
  reservations: ReservationSummary[]
  selectedId?: string | null
  today: string
}) {
  const { t } = useTranslation('common')
  const tomorrow = addDays(today, 1)

  const columns = useMemo<ColumnDef<ReservationSummary>[]>(() => {
    const palette = new Map<string, string>()

    return [
      {
        accessorKey: 'amenity_name',
        header: t('reservations.columns.amenity'),
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="h-[26px] w-[3px] shrink-0 rounded-full"
              style={{ background: `var(${accentFor(row.original.amenity_id, palette)})` }}
            />
            <span className="truncate text-sm font-semibold">{row.original.amenity_name}</span>
          </span>
        ),
      },
      {
        accessorKey: 'unit_number',
        header: t('reservations.columns.unit'),
        cell: ({ row }) => <span className="text-sm text-[var(--mantine-color-dimmed)]">{row.original.unit_number}</span>,
      },
      {
        accessorKey: 'resident_name',
        header: t('reservations.columns.resident'),
        meta: { hideBelow: 'md' },
        cell: ({ row }) => <span className="text-sm text-[var(--mantine-color-dimmed)]">{row.original.resident_name ?? '—'}</span>,
      },
      {
        accessorKey: 'status',
        header: t('reservations.columns.status'),
        cell: ({ row }) => <ReservationStatusBadge reservation={row.original} />,
      },
      openRowColumn(),
    ]
  }, [t])

  return (
    <DataTable
      columns={columns}
      data={reservations}
      fetching={fetching}
      groupBy={(reservation) => {
        const day = reservation.reserved_on
        const prefix = day === today ? `${t('reservations.today')} · ` : day === tomorrow ? `${t('reservations.tomorrow')} · ` : ''

        return `${prefix}${dayHeading(day)}`
      }}
      loading={loading}
      selectedId={selectedId}
      toolbar={toolbar}
      onRowClick={onSelect}
    />
  )
}
