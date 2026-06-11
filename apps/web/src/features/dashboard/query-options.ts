// Location-scoped keys deliberately live outside the 'auth' prefix so that
// account/location context switches invalidate them (see
// invalidateContextDependentQueries in features/auth/hooks.ts).
export function locationDashboardQueryKey(locationId: string) {
  return ['locations', locationId, 'dashboard'] as const
}
