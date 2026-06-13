import { createFileRoute } from '@tanstack/react-router'
import { UnitsRegistryPage } from '../../../../features/units/units-registry-page'

export const Route = createFileRoute('/_authenticated/admin/registry/units')({
  component: UnitsRegistryPage,
  validateSearch: (search) => ({
    page: Number(search.page ?? 1),
    per_page: Number(search.per_page ?? 15),
    search: typeof search.search === 'string' ? search.search : '',
    sort: typeof search.sort === 'string' ? search.sort : '',
    status: typeof search.status === 'string' ? search.status : '',
  }),
})
