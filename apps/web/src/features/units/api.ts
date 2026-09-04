import { apiRequest } from '../../app/api-client'
import { buildParams } from '../../lib/query-params'
import type { MovementSummary } from '../finances/api'
import type { ReservationSummary } from '../reservations/api'
import type { PaginatedApiResponse, RegistrySearch } from '../registry/types'
import type { VehicleSummary } from '../vehicles/api'
import type { MembershipPayload, UnitPayload } from './schemas'

export type UnitType = 'apartment' | 'house' | 'commercial' | 'office'
export type UnitOccupancy = 'occupied' | 'vacant' | 'attention'
export type UnitPortalState = 'active' | 'invited' | 'not_invited' | null

export type UnitSummary = {
  id: string
  account_id: string
  location_id: string
  unit_number: string
  type: UnitType
  building_name: string | null
  floor: string | null
  area_m2: number | null
  participation_share: number | null
  maintenance_fee: number | null
  parking_spots: string[]
  storage_rooms: string[]
  status: 'active' | 'inactive'
  notes: string | null
  resident_count: number
  vehicle_count: number
  occupancy: UnitOccupancy
  portal_state: UnitPortalState
  primary_contact: {
    name: string
    phone: string | null
    email: string | null
    resident_type: string
    resident_id: string
    unit_membership_id: string
  } | null
}

export type UnitsSearch = RegistrySearch & {
  occupancy?: string
  portal?: string
  fee?: string
  type?: string
}

export function getUnits(locationId: string, search: UnitsSearch) {
  const params = buildParams(search)

  return apiRequest<PaginatedApiResponse<UnitSummary>>(
    `/api/locations/${locationId}/units?${params.toString()}`,
  )
}

export function createUnit(locationId: string, payload: UnitPayload) {
  return apiRequest<{ data: UnitSummary }>(`/api/locations/${locationId}/units`, { data: payload, method: 'POST' })
}

export function updateUnit(unitId: string, payload: Partial<UnitPayload> & { status?: 'active' | 'inactive' }) {
  return apiRequest<{ data: UnitSummary }>(`/api/units/${unitId}`, { data: payload, method: 'PATCH' })
}

export function deactivateUnit(unitId: string) {
  return apiRequest<{ data: UnitSummary }>(`/api/units/${unitId}/deactivate`, { method: 'POST', data: {} })
}

export function reactivateUnit(unitId: string) {
  return apiRequest<{ data: UnitSummary }>(`/api/units/${unitId}/reactivate`, { method: 'POST', data: {} })
}

/** Existing person → new membership in this unit. */
export function createMembership(residentId: string, payload: MembershipPayload) {
  return apiRequest<{ data: { id: string } }>(`/api/residents/${residentId}/memberships`, { method: 'POST', data: payload })
}

/** New person and their membership in one call (ResidentController::store accepts memberships[]). */
export function createResidentInUnit(
  accountId: string,
  person: { first_name: string; last_name: string; email: string | null; phone: string | null },
  membership: MembershipPayload,
) {
  return apiRequest<{ data: { id: string; email: string | null } }>(`/api/accounts/${accountId}/residents`, {
    method: 'POST',
    data: { ...person, memberships: [membership] },
  })
}

export function updateMembership(membershipId: string, payload: Partial<Pick<MembershipPayload, 'resident_type' | 'is_primary_contact'>>) {
  return apiRequest<{ data: { id: string } }>(`/api/unit-memberships/${membershipId}`, { method: 'PATCH', data: payload })
}

export function removeMembership(membershipId: string) {
  return apiRequest<{ data: { id: string } }>(`/api/unit-memberships/${membershipId}`, { method: 'DELETE' })
}

export function inviteResidentToPortal(residentId: string) {
  return apiRequest<{ resident: unknown; invitation: unknown }>(`/api/residents/${residentId}/invitations`, { method: 'POST', data: {} })
}

export type UnitMember = {
  membership_id: string
  resident_id: string
  name: string
  email: string | null
  phone: string | null
  resident_type: 'owner' | 'tenant' | 'occupant' | 'guest_resident'
  is_primary_contact: boolean
  started_at: string | null
  portal_state: 'active' | 'invited' | 'not_invited'
}

export type UnitDetail = UnitSummary & { members: UnitMember[]; vehicles: VehicleSummary[] }

export type UnitNote = { id: string; body: string; author_name: string | null; created_at: string | null }

/** GET /units/{id}: the unit plus the sections that read other modules. */
export type UnitDetailResponse = {
  data: UnitDetail
  reservations: ReservationSummary[]
  movements: MovementSummary[]
  movements_month: string
  pending_balance: number
  notes: UnitNote[]
}

export function getUnit(unitId: string) {
  return apiRequest<UnitDetailResponse>(`/api/units/${unitId}`)
}

export function addUnitNote(unitId: string, body: string) {
  return apiRequest<{ data: UnitNote }>(`/api/units/${unitId}/notes`, { method: 'POST', data: { body } })
}
