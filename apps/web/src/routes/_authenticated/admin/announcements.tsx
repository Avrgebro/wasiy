import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '../../../components/ui/page-placeholder'
import { hasCapability } from '../../../features/auth/access'
import { checkSurfaceAccess } from '../../../features/auth/guards'

export const Route = createFileRoute('/_authenticated/admin/announcements')({
  // The sidebar hides this entry, but hiding is not enforcement: a typed URL
  // must be turned away too.
  beforeLoad: ({ context }) => {
    checkSurfaceAccess(context.me, hasCapability('announcements.manage'))
  },
  component: () => <PagePlaceholder titleKey="nav.announcements" />,
})
