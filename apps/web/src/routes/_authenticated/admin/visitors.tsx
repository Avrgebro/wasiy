import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '../../../components/ui/page-placeholder'

export const Route = createFileRoute('/_authenticated/admin/visitors')({
  component: () => <PagePlaceholder titleKey="nav.visitors" />,
})
