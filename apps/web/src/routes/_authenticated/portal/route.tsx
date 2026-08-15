import { createFileRoute } from '@tanstack/react-router'
import { PortalLayout } from '../../../components/layout/portal/portal-layout'
import { surfaceRouteOptions } from '../../../features/auth/surface-route'

export const Route = createFileRoute('/_authenticated/portal')(
  surfaceRouteOptions('portal', PortalLayout),
)
