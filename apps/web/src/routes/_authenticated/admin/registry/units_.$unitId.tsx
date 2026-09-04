import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '../../../../components/ui/page-placeholder'

// Slice 3 replaces the placeholder with the unit detail page (mockup 12).
export const Route = createFileRoute('/_authenticated/admin/registry/units_/$unitId')({
  component: () => <PagePlaceholder titleKey="units.title" />,
})
