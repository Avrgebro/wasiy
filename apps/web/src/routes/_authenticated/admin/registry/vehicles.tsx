import { createFileRoute } from '@tanstack/react-router'
import { vehicleRegistrySearchSchema } from '../../../../features/registry/search'
import { VehiclesRegistryPage } from '../../../../features/vehicles/vehicles-registry-page'

export const Route = createFileRoute('/_authenticated/admin/registry/vehicles')({
  component: VehiclesRegistryPage,
  validateSearch: vehicleRegistrySearchSchema,
})
