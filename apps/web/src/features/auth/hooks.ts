import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { login, logout, selectAccount, selectLocation } from './api'
import { sessionQueryKey, sessionQueryOptions } from './query-options'
import type { LoginCredentials, MeResponse, Session } from './types'

export function useSession() {
  return useQuery(sessionQueryOptions())
}

export function useMe() {
  return useQuery({
    ...sessionQueryOptions(),
    select: (session: Session) =>
      session.status === 'authenticated' ? session.me : null,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      await login(credentials)

      // The login guard has just cached an anonymous session, and within
      // staleTime fetchQuery would happily return it. The successful login
      // invalidated that state by definition, so force the refetch.
      return queryClient.fetchQuery({
        ...sessionQueryOptions(),
        staleTime: 0,
      })
    },
    // The login form maps failures onto field/root errors itself.
    meta: { suppressErrorNotification: true },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Writing the anonymous state (rather than removing the query) means
      // the /login guard resolves from cache with no network round-trip and
      // nothing in flight gets cancelled.
      queryClient.setQueryData<Session>(sessionQueryKey, {
        status: 'anonymous',
      })
    },
  })
}

// Convention: every query key outside the 'auth' prefix is assumed to depend
// on the active account/location context and is invalidated when that
// context changes. Keep context-independent data under the 'auth' prefix.
function invalidateContextDependentQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] !== sessionQueryKey[0],
  })
}

function applyAuthenticatedMe(queryClient: QueryClient, me: MeResponse) {
  const session: Session = { status: 'authenticated', me }

  queryClient.setQueryData(sessionQueryKey, session)
  invalidateContextDependentQueries(queryClient)
}

export function useSelectAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: selectAccount,
    onSuccess: (me) => applyAuthenticatedMe(queryClient, me),
    // SelectAccountPage renders the failure as an inline alert.
    meta: { suppressErrorNotification: true },
  })
}

export function useSelectLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: selectLocation,
    onSuccess: (me) => applyAuthenticatedMe(queryClient, me),
  })
}
