import { createFileRoute, redirect } from '@tanstack/react-router'

// Units moved to /admin/units on 2026-09-06; old links land on the new list.
export const Route = createFileRoute('/_authenticated/admin/registry/units')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/units', search: { page: 1, search: '', sort: '', type: '', status: '', attention: undefined } })
  },
})
