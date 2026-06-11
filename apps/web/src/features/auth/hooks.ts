import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { login, logout, selectAccount, selectLocation } from './api'
import { meQueryKey, meQueryOptions } from './query-options'
import type { LoginCredentials } from './types'

export function useMe() {
  return useQuery(meQueryOptions())
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      await login(credentials)

      return queryClient.fetchQuery(meQueryOptions())
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: meQueryKey })
    },
  })
}

function invalidateContextDependentQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] !== meQueryKey[0],
  })
}

export function useSelectAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: selectAccount,
    onSuccess: (me) => {
      queryClient.setQueryData(meQueryKey, me)
      invalidateContextDependentQueries(queryClient)
    },
  })
}

export function useSelectLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: selectLocation,
    onSuccess: (me) => {
      queryClient.setQueryData(meQueryKey, me)
      invalidateContextDependentQueries(queryClient)
    },
  })
}
