import { queryOptions } from '@tanstack/react-query'
import { getResidentInvitation, getStaffInvitation } from './api'

export const residentInvitationQueryKey = (token: string) =>
  ['invitations', 'resident', token] as const

export function residentInvitationQueryOptions(token: string) {
  return queryOptions({
    queryKey: residentInvitationQueryKey(token),
    queryFn: () => getResidentInvitation(token),
    // A claim token is single-use and its 410 responses are terminal, so
    // retrying only delays the expired state.
    retry: false,
    staleTime: 0,
  })
}

export const staffInvitationQueryKey = (token: string) =>
  ['invitations', 'staff', token] as const

export function staffInvitationQueryOptions(token: string) {
  return queryOptions({
    queryKey: staffInvitationQueryKey(token),
    queryFn: () => getStaffInvitation(token),
    retry: false,
    staleTime: 0,
  })
}
