import type { ReservationSummary } from './api'

type ReservationStatusKey = ReservationSummary['status'] | 'completed'

const STATUS_COLORS: Record<ReservationStatusKey, string> = {
  pending: 'warning',
  approved: 'success',
  observed: 'info',
  rejected: 'error',
  cancelled: 'gray',
  completed: 'gray',
}

/** The status the UI shows: an approved reservation whose slot has passed reads as completed. */
export function reservationStatusKey(reservation: Pick<ReservationSummary, 'status' | 'is_completed'>): ReservationStatusKey {
  return reservation.is_completed ? 'completed' : reservation.status
}

/** Pill color for a reservation status; the single source for every list, drawer and panel. */
export function reservationStatusColor(status: ReservationStatusKey): string {
  return STATUS_COLORS[status]
}
