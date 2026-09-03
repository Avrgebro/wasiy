import { createFileRoute } from '@tanstack/react-router'
import { canManageRegistry } from '../../../features/auth/access'
import { checkSurfaceAccess } from '../../../features/auth/guards'
import { FinancesPage } from '../../../features/finances/finances-page'
import { financesSearchSchema } from '../../../features/finances/schemas'

export const Route = createFileRoute('/_authenticated/admin/finances')({
  // The sidebar hides this entry, but hiding is not enforcement: a typed URL
  // must be turned away too.
  beforeLoad: ({ context }) => {
    checkSurfaceAccess(context.me, canManageRegistry)
  },
  component: FinancesPage,
  validateSearch: financesSearchSchema,
})
