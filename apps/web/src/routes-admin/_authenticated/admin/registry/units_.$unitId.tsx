import { createFileRoute, redirect } from '@tanstack/react-router'

// Unit detail moved to /admin/units/$unitId on 2026-09-06.
export const Route = createFileRoute('/_authenticated/admin/registry/units_/$unitId')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/admin/units/$unitId', params: { unitId: params.unitId } })
  },
})
