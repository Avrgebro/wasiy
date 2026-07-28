import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { acceptStaffInvitation, claimResidentInvitation } from './api'
import {
  residentInvitationQueryOptions,
  staffInvitationQueryOptions,
} from './query-options'
import { applyAuthenticatedMe } from '../auth/hooks'

export function useResidentInvitation(token: string) {
  return useQuery(residentInvitationQueryOptions(token))
}

export function useStaffInvitation(token: string) {
  return useQuery(staffInvitationQueryOptions(token))
}

export function useAcceptStaffInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: acceptStaffInvitation,
    onSuccess: (result) => {
      if (result.session) {
        applyAuthenticatedMe(queryClient, result.session)
      }
    },
    // The acceptance page renders 401 and 409 as their own states.
    meta: { suppressErrorNotification: true },
  })
}

export function useClaimResidentInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: claimResidentInvitation,
    onSuccess: (result) => {
      // The claim signs the resident in server-side, so seeding the session
      // cache here is what lets the portal render without a second login.
      if (result.session) {
        applyAuthenticatedMe(queryClient, result.session)
      }
    },
    // The claim form renders failures inline.
    meta: { suppressErrorNotification: true },
  })
}
