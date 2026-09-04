import { createFileRoute } from '@tanstack/react-router'
import { unitsSearchSchema } from '../../../../features/units/schemas'
import { UnitsPage } from '../../../../features/units/units-page'

export const Route = createFileRoute('/_authenticated/admin/registry/units')({
  component: UnitsPage,
  validateSearch: unitsSearchSchema,
})
