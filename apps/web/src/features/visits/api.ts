import { apiRequest } from '../../app/api-client'
import { buildParams } from '../../lib/query-params'
import type { PaginatedApiResponse } from '../registry/types'

export type VisitConfirmation = 'none' | 'intercom' | 'phone' | 'management' | 'pre_registered'
/** expected → inside → left; a resident may cancel while expected (portal P1). */
export type VisitStatus = 'expected' | 'inside' | 'left' | 'cancelled'

export type VisitSummary = {
  id: string
  account_id: string
  location_id: string
  unit_id: string
  unit_number?: string
  building_name?: string | null
  resident_id: string | null
  resident_name?: string | null
  resident_phone?: string | null
  visitor_name: string
  document: string | null
  phone: string | null
  confirmation: VisitConfirmation
  notes: string | null
  status: VisitStatus
  expected_on: string | null
  expected_time: string | null
  pre_registered_by_name?: string | null
  pre_registered_at: string | null
  cancelled_at: string | null
  checked_in_at: string | null
  checked_in_by_name?: string | null
  checked_out_at: string | null
  checked_out_by_name?: string | null
  checkout_notes: string | null
  auto_checked_out: boolean
}

export type VisitsSearch = { status?: string; today?: number; expected?: number; unit_id?: string; confirmation?: string; search?: string; page?: number; per_page?: number }

export function getVisits(locationId: string, search: VisitsSearch) {
  const params = buildParams(search)

  return apiRequest<PaginatedApiResponse<VisitSummary>>(`/api/locations/${locationId}/visits?${params.toString()}`)
}

export type RegisterVisitPayload = {
  visitor_name: string
  unit_id: string
  resident_id: string | null
  document: string | null
  phone: string | null
  confirmation: VisitConfirmation
  notes: string | null
}

export function registerVisit(locationId: string, payload: RegisterVisitPayload) {
  return apiRequest<{ data: VisitSummary }>(`/api/locations/${locationId}/visits`, { method: 'POST', data: payload })
}

/** The desk confirms a pre-registered visitor is at the door (16c); corrections travel with it. */
export function confirmArrival(visitId: string, payload: { visitor_name?: string; document?: string | null; phone?: string | null; notes?: string | null }) {
  return apiRequest<{ data: VisitSummary }>(`/api/visits/${visitId}/confirm-arrival`, { method: 'POST', data: payload })
}

export function checkOutVisit(visitId: string, notes: string | null) {
  return apiRequest<{ data: VisitSummary }>(`/api/visits/${visitId}/check-out`, { method: 'POST', data: { notes } })
}
