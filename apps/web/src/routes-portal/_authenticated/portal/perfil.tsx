import { createFileRoute } from '@tanstack/react-router'
import { PortalProfilePage } from '../../../features/portal/portal-profile-page'

export const Route = createFileRoute('/_authenticated/portal/perfil')({
  component: PortalProfilePage,
})
