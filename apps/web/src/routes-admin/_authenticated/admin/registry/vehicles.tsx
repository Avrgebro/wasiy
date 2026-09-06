import { createFileRoute, redirect } from '@tanstack/react-router'

// Vehicles live inside units since M9; old bookmarks land on the units list,
// where plates are searchable.
export const Route = createFileRoute('/_authenticated/admin/registry/vehicles')({
  beforeLoad: () => {
    throw redirect({
      to: '/admin/registry/units',
      search: { page: 1, search: '', sort: '', type: '', status: '', attention: undefined },
    })
  },
})
