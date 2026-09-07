import { createFileRoute } from '@tanstack/react-router'
import { SubscriptionPage } from '../../../features/subscription/subscription-page'

// No admin guard on purpose: a lapsed account sends every staff role here.
export const Route = createFileRoute('/_authenticated/admin/subscription')({
  component: SubscriptionPage,
})
