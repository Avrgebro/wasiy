import { createFileRoute } from '@tanstack/react-router'
import { VehiclesRegistryPage } from '../../../../features/vehicles/vehicles-registry-page'

export const Route = createFileRoute('/_authenticated/admin/registry/vehicles')({
  component: VehiclesRegistryPage,
  validateSearch: (search) => ({
    page: Number(search.page ?? 1),
    per_page: Number(search.per_page ?? 15),
    search: typeof search.search === 'string' ? search.search : '',
    sort: typeof search.sort === 'string' ? search.sort : '',
    status: typeof search.status === 'string' ? search.status : '',
    vehicle_type:
      typeof search.vehicle_type === 'string' ? search.vehicle_type : '',
  }),
})
