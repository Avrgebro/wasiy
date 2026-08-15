import { createFileRoute } from '@tanstack/react-router'
import { AppShell } from '../../../components/layout/shared/app-shell'
import { surfaceRouteOptions } from '../../../features/auth/surface-route'

export const Route = createFileRoute('/_authenticated/admin')(
  surfaceRouteOptions('admin', AppShell),
)
