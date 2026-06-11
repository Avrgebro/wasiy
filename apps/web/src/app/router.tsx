import { createRouter } from '@tanstack/react-router'
import { queryClient } from './query-client'
import {
  RouteErrorFallback,
  RouteNotFoundFallback,
  RoutePendingFallback,
} from './route-fallbacks'
import { installSessionExpiryHandler } from '../features/auth/session'
import { routeTree } from '../routeTree.gen'

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultErrorComponent: RouteErrorFallback,
  defaultNotFoundComponent: RouteNotFoundFallback,
  defaultPendingComponent: RoutePendingFallback,
  // Preload link targets on hover/focus; guards resolve from the session
  // cache, so this is cheap and makes navigations feel instant.
  defaultPreload: 'intent',
})

installSessionExpiryHandler(queryClient, router)

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
