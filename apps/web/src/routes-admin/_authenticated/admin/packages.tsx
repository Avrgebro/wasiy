import { createFileRoute } from '@tanstack/react-router'
import { PackagesPage } from '../../../features/packages/packages-page'
import { packagesSearchSchema } from '../../../features/packages/schemas'

export const Route = createFileRoute('/_authenticated/admin/packages')({
  component: PackagesPage,
  validateSearch: packagesSearchSchema,
})
