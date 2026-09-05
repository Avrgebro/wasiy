import { createFileRoute } from '@tanstack/react-router'
import { PortalAlertsPage } from '../../../features/portal/portal-alerts-page'

export const Route = createFileRoute('/_authenticated/portal/alertas')({
  component: PortalAlertsPage,
})
