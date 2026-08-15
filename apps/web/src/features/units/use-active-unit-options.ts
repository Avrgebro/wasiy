import { useQuery } from '@tanstack/react-query'
import { getUnits } from './api'
import { formatUnitLabel } from './unit-label'

/**
 * Select options for the location's active units. Capped at the first 100
 * units — this is the single owner of that limit.
 */
export function useActiveUnitOptions(location: { id: string } | null) {
  const unitsQuery = useQuery({
    enabled: Boolean(location),
    queryKey: ['registry', 'units', location?.id, { per_page: 100, status: 'active' }],
    queryFn: () =>
      getUnits(location?.id ?? '', {
        page: 1,
        per_page: 100,
        status: 'active',
      }),
  })

  return (unitsQuery.data?.data ?? []).map((unit) => ({
    label: formatUnitLabel(unit),
    value: unit.id,
  }))
}
