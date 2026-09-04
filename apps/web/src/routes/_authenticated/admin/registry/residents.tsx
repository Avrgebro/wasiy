import { createFileRoute } from '@tanstack/react-router'
import { ResidentsPage } from '../../../../features/residents/residents-page'
import { residentsSearchSchema } from '../../../../features/residents/schemas'

export const Route = createFileRoute('/_authenticated/admin/registry/residents')({
  component: ResidentsPage,
  validateSearch: residentsSearchSchema,
})
