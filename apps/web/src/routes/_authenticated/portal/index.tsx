import { createFileRoute } from '@tanstack/react-router'
import { PortalDashboardPage } from '../../../features/portal/portal-dashboard-page'

export const Route = createFileRoute('/_authenticated/portal/')({
  component: PortalDashboardPage,
})
