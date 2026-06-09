import type { QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
} from '@tanstack/react-router'
import { apiClient, installAuthInterceptors } from '../app/api-client'
import { meQueryKey } from '../features/auth/query-options'

type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootRoute,
})

function RootRoute() {
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    const interceptorId = installAuthInterceptors(() => {
      queryClient.removeQueries({ queryKey: meQueryKey })

      if (router.state.location.pathname !== '/login') {
        void router.navigate({ to: '/login' })
      }
    })

    return () => {
      apiClient.interceptors.response.eject(interceptorId)
    }
  }, [queryClient, router])

  return <Outlet />
}
