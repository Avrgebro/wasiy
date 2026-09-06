import { createFileRoute } from '@tanstack/react-router'
import { PortalMyUnitPage } from '../../../features/portal/portal-my-unit-page'

export const Route = createFileRoute('/_authenticated/portal/mi-unidad')({
  component: PortalMyUnitPage,
})
