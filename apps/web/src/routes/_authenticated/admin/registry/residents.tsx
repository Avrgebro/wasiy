import { createFileRoute } from '@tanstack/react-router'
import { registrySearchSchema } from '../../../../features/registry/search'
import { ResidentsRegistryPage } from '../../../../features/residents/residents-registry-page'

export const Route = createFileRoute('/_authenticated/admin/registry/residents')({
  component: ResidentsRegistryPage,
  validateSearch: registrySearchSchema,
})
