import { apiRequest } from '../../app/api-client'
import { buildParams } from '../../lib/query-params'
import type { PaginatedApiResponse, RegistrySearch } from '../registry/types'

export type PortalState = 'active' | 'invited' | 'not_invited'

export type ResidentMembership = {
  id: string
  unit_id: string
  location_id: string
  status: 'active' | 'inactive'
  is_primary_contact: boolean
  unit?: { id: string; unit_number: string; building_name: string | null; floor: string | null }
}

export type ResidentSummary = {
  id: string
  account_id: string
  user_id: string | null
  first_name: string
  last_name: string
  name: string
  phone: string | null
  /** Absent for front desk: the API strips it (M11). */
  email?: string | null
  status: 'active' | 'inactive'
  portal_state: PortalState
  active_membership_count: number
  memberships: ResidentMembership[]
  created_at?: string | null
}

export type ResidentsSearch = RegistrySearch & {
  location_id?: string
  unit_id?: string
  role?: string
  portal?: string
}

export function getResidents(accountId: string, search: ResidentsSearch) {
  const params = buildParams(search)

  return apiRequest<PaginatedApiResponse<ResidentSummary>>(`/api/accounts/${accountId}/residents?${params.toString()}`)
}

export type ResidentHistoryEntry = {
  id: string
  event_type: string
  summary: string
  actor_name: string | null
  created_at: string | null
}

export function getResident(residentId: string) {
  return apiRequest<{ data: ResidentSummary; history: ResidentHistoryEntry[] }>(`/api/residents/${residentId}`)
}

export type PersonPayload = { first_name: string; last_name: string; phone: string | null }
export type MembershipPayload = { unit_id: string; is_primary_contact: boolean }

/** Directory create: names, optional phone, optional unit relation. Never an email. */
export function createPerson(accountId: string, person: PersonPayload, membership: MembershipPayload) {
  return apiRequest<{ data: ResidentSummary }>(`/api/accounts/${accountId}/residents`, {
    method: 'POST',
    data: { ...person, memberships: [membership] },
  })
}

export function updatePerson(residentId: string, person: PersonPayload) {
  return apiRequest<{ data: ResidentSummary }>(`/api/residents/${residentId}`, { method: 'PATCH', data: person })
}

export function deactivatePerson(residentId: string) {
  return apiRequest<{ data: ResidentSummary }>(`/api/residents/${residentId}/deactivate`, { method: 'POST', data: {} })
}

export function reactivatePerson(residentId: string) {
  return apiRequest<{ data: ResidentSummary }>(`/api/residents/${residentId}/reactivate`, { method: 'POST', data: {} })
}

/** The only place an email is typed: it is stored on the person and the invitation goes there. */
export function invitePerson(residentId: string, email?: string) {
  return apiRequest<{ resident: unknown; invitation: unknown }>(`/api/residents/${residentId}/invitations`, {
    method: 'POST',
    data: email ? { email } : {},
  })
}
