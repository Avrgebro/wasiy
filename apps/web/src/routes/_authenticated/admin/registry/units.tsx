import { createFileRoute } from '@tanstack/react-router'
import { registrySearchSchema } from '../../../../features/registry/search'
import { UnitsRegistryPage } from '../../../../features/units/units-registry-page'

export const Route = createFileRoute('/_authenticated/admin/registry/units')({
  component: UnitsRegistryPage,
  validateSearch: registrySearchSchema,
})
