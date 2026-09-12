import { Text } from '@mantine/core'
import { ReservationStatusBadge } from './reservation-status-badge'
import type { ReservationSummary } from './api'
import { dayHeading } from './week'

/** The "miércoles 2 de septiembre [status]" band the reservation modals open with. */
export function ReservationDayBand({ reservation }: { reservation: ReservationSummary }) {
  return (
    // Surface-2 band; the pill uses the `surface` variant so it stays visible.
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-inner bg-[var(--wa-surface-2)] px-3.5 py-2.5">
      <Text className="capitalize" fw={600} size="sm">
        {dayHeading(reservation.reserved_on)}
      </Text>
      <ReservationStatusBadge reservation={reservation} />
    </div>
  )
}

/** Uppercase-label field, the Información general cell style. */
export function ReservationField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mantine-color-dimmed)]">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium text-[var(--mantine-color-text)]">
        {value}
      </div>
    </div>
  )
}
