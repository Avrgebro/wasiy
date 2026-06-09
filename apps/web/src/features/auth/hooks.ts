import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { login, logout } from './api'
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
