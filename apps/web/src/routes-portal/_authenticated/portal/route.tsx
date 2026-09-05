import { createFileRoute } from '@tanstack/react-router'
import { PortalLayout } from '../../../components/layout/portal/portal-layout'
import { surfaceRouteOptions } from '../../../features/auth/surface-route'
import { getPortalNavigation } from '../../../features/portal/navigation'

export const Route = createFileRoute('/_authenticated/portal')(
  surfaceRouteOptions('portal', PortalLayout, getPortalNavigation),
)
