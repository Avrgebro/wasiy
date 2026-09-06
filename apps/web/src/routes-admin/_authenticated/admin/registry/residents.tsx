import { createFileRoute, redirect } from '@tanstack/react-router'

// Residents moved to /admin/residents on 2026-09-06; old links land on the new list.
export const Route = createFileRoute('/_authenticated/admin/registry/residents')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/residents', search: { page: 1, search: '', portal: '', status: '' } })
  },
})
