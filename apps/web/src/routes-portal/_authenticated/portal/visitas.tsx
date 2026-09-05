import { createFileRoute } from '@tanstack/react-router'
import { PortalVisitsPage } from '../../../features/portal/portal-visits-page'

export const Route = createFileRoute('/_authenticated/portal/visitas')({
  component: PortalVisitsPage,
})
