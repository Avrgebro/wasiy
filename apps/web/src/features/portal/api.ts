import { apiRequest } from '../../app/api-client'
import { buildParams } from '../../lib/query-params'
import type { ResidentMembership } from '../auth/types'
import type { PaginatedApiResponse } from '../../lib/pagination'

export type PortalResident = {
  id: string
  account_id: string
  user_id: string
  first_name: string
  last_name: string
  name: string
  phone: string | null
  email: string | null
  status: 'active' | 'inactive'
  memberships: ResidentMembership[]
}

type PortalResidentResponse = {
  data: PortalResident
}

export async function updatePortalResidentPhone(phone: string | null) {
  const response = await apiRequest<PortalResidentResponse>(
    '/api/portal/resident/phone',
    {
      data: { phone },
      method: 'PATCH',
    },
  )

  return response.data
}

/** A visit as the resident sees it: their own announcements and what happened at the door. */
export type PortalVisitStatus = 'expected' | 'inside' | 'left' | 'cancelled'

export type PortalVisit = {
  id: string
  unit_id: string
  unit_number?: string
  building_name?: string | null
  visitor_name: string
  document: string | null
  notes: string | null
  status: PortalVisitStatus
  expected_on: string | null
  expected_time: string | null
  pre_registered_by_name?: string | null
  pre_registered_at: string | null
  checked_in_at: string | null
  checked_in_by_name?: string | null
  checked_out_at: string | null
  auto_checked_out: boolean
  cancelled_at: string | null
}

export type PortalVisitScope = 'expected' | 'today' | 'history'

export function getPortalVisits(unitId: string, scope: PortalVisitScope, page = 1) {
  const params = buildParams({ unit_id: unitId, scope, page })

  return apiRequest<PaginatedApiResponse<PortalVisit>>(`/api/portal/visits?${params.toString()}`)
}

export type PreRegisterVisitPayload = {
  unit_id: string
  visitor_name: string
  document: string | null
  expected_on: string
  expected_time: string | null
  notes: string | null
}

export function preRegisterVisit(payload: PreRegisterVisitPayload) {
  return apiRequest<{ data: PortalVisit }>('/api/portal/visits', { method: 'POST', data: payload })
}

export function cancelPortalVisit(visitId: string) {
  return apiRequest<{ data: PortalVisit }>(`/api/portal/visits/${visitId}/cancel`, { method: 'POST' })
}

export type PortalPackage = {
  id: string
  unit_id: string
  resident_name?: string | null
  notes: string | null
  status: 'pending' | 'delivered'
  received_at: string
  delivered_at: string | null
}

export function getPortalPackages(unitId: string, status?: 'pending' | 'delivered') {
  const params = buildParams({ unit_id: unitId, status })

  return apiRequest<PaginatedApiResponse<PortalPackage>>(`/api/portal/packages?${params.toString()}`)
}
