import { createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { redirectWithinSurface } from './guards'

/**
 * Regression: a redirect thrown from beforeLoad while the router preloads on
 * hover must resolve, not recurse. With `href` the preload rebuilt the same
 * destination forever and froze the tab.
 */
describe('redirectWithinSurface', () => {
  it('resolves a hover preload that hits a guard redirect', async () => {
    const rootRoute = createRootRoute()
    const landing = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: () => null })
    const guarded = createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/units/$unitId',
      beforeLoad: () => {
        throw redirectWithinSurface('/admin')
      },
      component: () => null,
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([landing, guarded]),
      history: createMemoryHistory({ initialEntries: ['/admin'] }),
    })
    await router.load()

    const preload = router.preloadRoute({ to: '/admin/units/$unitId', params: { unitId: 'u1' } } as never)
    const outcome = await Promise.race([
      preload.then(() => 'resolved'),
      new Promise<string>((resolve) => setTimeout(() => resolve('hung'), 3000)),
    ])

    expect(outcome).toBe('resolved')
    expect(router.state.location.pathname).toBe('/admin')
  })
})
