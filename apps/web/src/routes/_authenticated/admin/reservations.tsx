import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '../../../components/ui/page-placeholder'

export const Route = createFileRoute('/_authenticated/admin/reservations')({
  component: () => <PagePlaceholder titleKey="nav.reservations" />,
})
