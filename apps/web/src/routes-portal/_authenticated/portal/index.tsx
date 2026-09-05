import { createFileRoute } from '@tanstack/react-router'
import { PortalHomePage } from '../../../features/portal/portal-home-page'

export const Route = createFileRoute('/_authenticated/portal/')({
  component: PortalHomePage,
})
