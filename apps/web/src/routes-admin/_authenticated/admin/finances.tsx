import { createFileRoute } from '@tanstack/react-router'
import { hasCapability } from '../../../features/auth/access'
import { checkSurfaceAccess } from '../../../features/auth/guards'
import { FinancesPage } from '../../../features/finances/finances-page'
import { financesSearchSchema } from '../../../features/finances/schemas'

export const Route = createFileRoute('/_authenticated/admin/finances')({
  // The sidebar hides this entry, but hiding is not enforcement: a typed URL
  // must be turned away too.
  beforeLoad: ({ context }) => {
    checkSurfaceAccess(context.me, hasCapability('finances.manage'))
  },
  component: FinancesPage,
  validateSearch: financesSearchSchema,
})
