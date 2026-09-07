import { createFileRoute } from '@tanstack/react-router'
import { AccessPausedPage } from '../../features/subscription/access-paused-page'

// Outside the /admin shell on purpose: no sidebar to click around a locked account.
// Reached only through the lapse redirect for staff who are not account admins.
export const Route = createFileRoute('/_authenticated/access-paused')({
  component: AccessPausedPage,
})
