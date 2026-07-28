import { apiRequest } from '../../app/api-client'
import type { MeResponse } from '../auth/types'

export type ResidentInvitationDetails = {
  id: string
  email: string
  status: string
  purpose: string
  expires_at: string
  resident: {
    id: string
    name: string
    status: string
  }
  account: {
    id: string
    name: string
  }
}

export type ResidentInvitationClaimResult = {
  resident: { id: string }
  invitation: { id: string; status: string }
  // Null when the request was not stateful, in which case the SPA falls back
  // to sending the user through the login form.
  session: MeResponse | null
}

type ApiResponse<T> = { data: T }

export async function getResidentInvitation(token: string) {
  const response = await apiRequest<ApiResponse<ResidentInvitationDetails>>(
    `/api/resident-invitations/${encodeURIComponent(token)}`,
  )

  return response.data
}

export type StaffInvitationRoleSummary = {
  account_role: string | null
  locations: Array<{ name: string; role: string }>
}

export type StaffInvitationDetails = {
  email: string
  first_name: string
  last_name: string
  expires_at: string | null
  // False when a User already exists for the invited address, in which case
  // acceptance is a confirmation rather than a signup.
  requires_account_creation: boolean
  account: { id: string; name: string }
  invited_by: { name: string | null }
  roles: StaffInvitationRoleSummary
}

export type StaffInvitationAcceptResult = {
  skipped_location_ids: string[]
  session: MeResponse | null
}

export async function getStaffInvitation(token: string) {
  const response = await apiRequest<ApiResponse<StaffInvitationDetails>>(
    `/api/staff-invitations/${encodeURIComponent(token)}`,
  )

  return response.data
}

export async function acceptStaffInvitation(input: {
  token: string
  firstName?: string
  lastName?: string
  password?: string
  passwordConfirmation?: string
}) {
  const response = await apiRequest<ApiResponse<StaffInvitationAcceptResult>>(
    `/api/staff-invitations/${encodeURIComponent(input.token)}/accept`,
    {
      data:
        input.password === undefined
          ? {}
          : {
              first_name: input.firstName,
              last_name: input.lastName,
              password: input.password,
              password_confirmation: input.passwordConfirmation,
            },
      method: 'POST',
    },
  )

  return response.data
}

export async function claimResidentInvitation(input: {
  token: string
  password: string
  passwordConfirmation: string
}) {
  const response = await apiRequest<ApiResponse<ResidentInvitationClaimResult>>(
    `/api/resident-invitations/${encodeURIComponent(input.token)}/claim`,
    {
      data: {
        password: input.password,
        password_confirmation: input.passwordConfirmation,
      },
      method: 'POST',
    },
  )

  return response.data
}
