import { createFileRoute } from '@tanstack/react-router'
import { UnitDetailPage } from '../../../../features/units/unit-detail-page'

export const Route = createFileRoute('/_authenticated/admin/registry/units_/$unitId')({
  component: UnitDetailPage,
})
