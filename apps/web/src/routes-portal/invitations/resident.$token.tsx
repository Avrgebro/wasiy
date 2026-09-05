import { createFileRoute } from '@tanstack/react-router'
import { ResidentInvitationPage } from '../../features/invitations/resident-invitation-page'

// Deliberately outside _authenticated: the recipient has no session yet, and
// the claim itself is what signs them in.
export const Route = createFileRoute('/invitations/resident/$token')({
  component: RouteComponent,
})

function RouteComponent() {
  const { token } = Route.useParams()

  return <ResidentInvitationPage token={token} />
}
