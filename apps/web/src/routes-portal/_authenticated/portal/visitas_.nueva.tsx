import { createFileRoute } from '@tanstack/react-router'
import { PortalVisitFormPage } from '../../../features/portal/portal-visit-form-page'

export const Route = createFileRoute('/_authenticated/portal/visitas_/nueva')({
  component: PortalVisitFormPage,
})
