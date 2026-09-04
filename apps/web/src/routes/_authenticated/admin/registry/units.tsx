import { createFileRoute } from '@tanstack/react-router'
import { hasCapability } from '../../../../features/auth/access'
import { checkSurfaceAccess } from '../../../../features/auth/guards'
import { unitsSearchSchema } from '../../../../features/units/schemas'
import { UnitsPage } from '../../../../features/units/units-page'

export const Route = createFileRoute('/_authenticated/admin/registry/units')({
  // Hidden from the desk's sidebar, and a typed URL is turned away too.
  beforeLoad: ({ context }) => {
    checkSurfaceAccess(context.me, hasCapability('registry.manage'))
  },
  component: UnitsPage,
  validateSearch: unitsSearchSchema,
})
