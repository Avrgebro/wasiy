import { createFileRoute } from '@tanstack/react-router'
import { AppShell } from '../../../components/layout/shared/app-shell'
import { surfaceRouteOptions } from '../../../features/auth/surface-route'
import { getAdminNavigation } from '../../../features/navigation/admin-navigation'

export const Route = createFileRoute('/_authenticated/admin')(
  surfaceRouteOptions('admin', AppShell, getAdminNavigation),
)
