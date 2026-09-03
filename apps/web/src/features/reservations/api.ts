import { apiRequest } from '../../app/api-client'
import { buildParams } from '../../lib/query-params'
import type { MovementSummary } from '../finances/api'

export type ReservationStatusValue =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'observed'
  | 'cancelled'

export type ReservationSummary = {
  id: string
  account_id: string
  location_id: string
  amenity_id: string
  amenity_name?: string
  unit_id: string
  unit_number?: string
  resident_id: string | null
  resident_name?: string | null
  starts_at: string
  ends_at: string
  status: ReservationStatusValue
  is_completed: boolean
  status_note: string | null
  fee_snapshot: number | null
  deposit_snapshot: number | null
  /** Ledger rows opened on approval; absent or empty for pending requests. */
  movements?: MovementSummary[]
  created_by_name?: string | null
  decided_by_name?: string | null
  decided_at: string | null
  created_at: string | null
}

export type ReservationListResponse = { data: ReservationSummary[] }

export type ReservationsSearch = {
  from?: string
  to?: string
  status?: string
  amenity_id?: string
}

function base(accountId: string, locationId: string) {
  return `/api/accounts/${accountId}/locations/${locationId}/reservations`
}

export function getReservations(accountId: string, locationId: string, search: ReservationsSearch) {
  const params = buildParams(search)

  return apiRequest<ReservationListResponse>(`${base(accountId, locationId)}?${params.toString()}`)
}

export type ReservationPayload = {
  amenity_id: string
  unit_id: string
  resident_id?: string | null
  date: string
  start: string
  end: string
}

export function createReservation(accountId: string, locationId: string, payload: ReservationPayload) {
  return apiRequest<{ data: ReservationSummary }>(base(accountId, locationId), {
    method: 'POST',
    data: payload,
  })
}

function transition(accountId: string, reservationId: string, action: string, note?: string) {
  return apiRequest<{ data: ReservationSummary }>(
    `/api/accounts/${accountId}/reservations/${reservationId}/${action}`,
    { method: 'POST', data: note === undefined ? {} : { note } },
  )
}

export function approveReservation(accountId: string, reservationId: string) {
  return transition(accountId, reservationId, 'approve')
}

export function rejectReservation(accountId: string, reservationId: string, note: string) {
  return transition(accountId, reservationId, 'reject', note)
}

export function observeReservation(accountId: string, reservationId: string, note: string) {
  return transition(accountId, reservationId, 'observe', note)
}

export function cancelReservation(accountId: string, reservationId: string, note?: string) {
  return transition(accountId, reservationId, 'cancel', note)
}
