import { createFileRoute } from '@tanstack/react-router'
import { AccountPage } from '../../../features/account/account-page'

// Every staff role: the admin layout already requires a signed-in staff user.
export const Route = createFileRoute('/_authenticated/admin/account')({
  component: AccountPage,
})
