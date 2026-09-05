import { createFileRoute } from '@tanstack/react-router'
import { StaffInvitationPage } from '../../features/invitations/staff-invitation-page'

// Public: an invitee may have no session at all, and an existing user is sent
// through /login and back here by the page itself.
export const Route = createFileRoute('/invitations/staff/$token')({
  component: RouteComponent,
})

function RouteComponent() {
  const { token } = Route.useParams()

  return <StaffInvitationPage token={token} />
}
