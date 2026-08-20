import { apiRequest } from '../../app/api-client'
import { buildParams } from '../../lib/query-params'
import type { AccountRole, LocationRole } from '../auth/types'
import type { PaginatedApiResponse } from '../registry/types'

export type StaffLocationAssignment = {
  location_id: string
  location_name: string | null
  role: LocationRole
}

export type StaffSummary = {
  id: string
  first_name: string
  last_name: string
  name: string
  email: string
  deactivated_at: string | null
  account_role: AccountRole | null
  location_assignments: StaffLocationAssignment[]
}

export type PendingStaffInvitation = {
  id: string
  email: string
  first_name: string
  last_name: string
  expires_at: string | null
  invited_by: { name: string | null }
  invited_account_role: AccountRole | null
  invited_location_assignments: Array<{
    location_id: string
    role: LocationRole
  }>
}

export type StaffListResponse = PaginatedApiResponse<StaffSummary>

export type StaffSearch = {
  page?: number
  per_page?: number
  search?: string
  role?: string
  location_id?: string
  status?: string
}

export type LocationAssignmentInput = {
  location_id: string
  role: LocationRole
}

export type StaffInvitationPayload = {
  email: string
  first_name: string
  last_name: string
  account_role: AccountRole | null
  location_assignments: LocationAssignmentInput[]
}

export function getStaff(accountId: string, search: StaffSearch) {
  const params = buildParams(search)

  return apiRequest<StaffListResponse>(
    `/api/accounts/${accountId}/staff?${params.toString()}`,
  )
}

export function deactivateStaff(accountId: string, userId: string) {
  return apiRequest<{ data: StaffSummary }>(
    `/api/accounts/${accountId}/staff/${userId}/deactivate`,
    { method: 'POST' },
  )
}

export function reactivateStaff(accountId: string, userId: string) {
  return apiRequest<{ data: StaffSummary }>(
    `/api/accounts/${accountId}/staff/${userId}/reactivate`,
    { method: 'POST' },
  )
}

export function getPendingStaffInvitations(accountId: string) {
  return apiRequest<{ data: PendingStaffInvitation[] }>(
    `/api/accounts/${accountId}/staff/invitations`,
  )
}

export function createStaffInvitation(accountId: string, payload: StaffInvitationPayload) {
  return apiRequest(`/api/accounts/${accountId}/staff/invitations`, {
    data: {
      email: payload.email,
      first_name: payload.first_name,
      last_name: payload.last_name,
      ...(payload.account_role ? { account_role: payload.account_role } : {}),
      location_assignments: payload.location_assignments,
    },
    method: 'POST',
  })
}

export function revokeStaffInvitation(accountId: string, invitationId: string) {
  return apiRequest(`/api/accounts/${accountId}/staff/invitations/${invitationId}`, {
    method: 'DELETE',
  })
}

export function resendStaffInvitation(accountId: string, invitationId: string) {
  return apiRequest(`/api/accounts/${accountId}/staff/invitations/${invitationId}/resend`, {
    method: 'POST',
  })
}

export function updateStaffAccess(
  accountId: string,
  userId: string,
  access: {
    account_role: AccountRole | null
    location_assignments: LocationAssignmentInput[]
  },
) {
  return apiRequest<{ data: StaffSummary }>(
    `/api/accounts/${accountId}/staff/${userId}/access`,
    {
      data: access,
      method: 'PATCH',
    },
  )
}
