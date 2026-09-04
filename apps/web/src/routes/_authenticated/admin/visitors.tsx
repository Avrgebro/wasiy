import { createFileRoute } from '@tanstack/react-router'
import { visitsSearchSchema } from '../../../features/visits/schemas'
import { VisitsPage } from '../../../features/visits/visits-page'

export const Route = createFileRoute('/_authenticated/admin/visitors')({
  component: VisitsPage,
  validateSearch: visitsSearchSchema,
})
