import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '../../../components/ui/page-placeholder'

export const Route = createFileRoute('/_authenticated/front-desk/')({
  component: () => <PagePlaceholder titleKey="nav.checkIn" />,
})
