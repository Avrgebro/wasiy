import { createFileRoute } from '@tanstack/react-router'
import { ImportsRegistryPage } from '../../../../features/imports/imports-registry-page'

export const Route = createFileRoute('/_authenticated/admin/registry/imports')({
  component: ImportsRegistryPage,
})

