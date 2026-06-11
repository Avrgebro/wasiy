import { createRouter } from '@tanstack/react-router'
import { queryClient } from './query-client'
import {
  RouteErrorFallback,
  RouteNotFoundFallback,
  RoutePendingFallback,
} from './route-fallbacks'
import { routeTree } from '../routeTree.gen'

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultErrorComponent: RouteErrorFallback,
  defaultNotFoundComponent: RouteNotFoundFallback,
  defaultPendingComponent: RoutePendingFallback,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
