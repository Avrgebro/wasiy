import { createFileRoute } from '@tanstack/react-router'
import { hasCapability } from '../../../features/auth/access'
import { checkSurfaceAccess } from '../../../features/auth/guards'
import { UnitDetailPage } from '../../../features/units/unit-detail-page'

export const Route = createFileRoute('/_authenticated/admin/units_/$unitId')({
  beforeLoad: ({ context }) => {
    checkSurfaceAccess(context.me, hasCapability('registry.manage'))
  },
  component: UnitDetailPage,
})
