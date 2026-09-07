import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { RegistrationPage } from '../features/registration/registration-page'
import { getPendingRegistration, getRegistrationPlans } from '../features/registration/api'
import { redirectWithinSurface, resolveSession } from '../features/auth/guards'
import { getDefaultAuthenticatedRoute } from '../features/auth/access'
import { sessionQueryKey } from '../features/auth/query-options'

export const Route = createFileRoute('/registro')({
  validateSearch: z.object({ plan: z.enum(['esencial', 'operativo']).catch('operativo') }),
  beforeLoad: async ({ context }) => {
    const session = await resolveSession(context)
    if (session.status === 'authenticated') throw redirectWithinSurface(getDefaultAuthenticatedRoute(session.me))
    if (session.status === 'deactivated') throw redirect({ to: '/no-access' })
  },
  loader: async () => {
    const [plans, pending] = await Promise.all([getRegistrationPlans(), getPendingRegistration()])
    return { plans: plans.data, pending: pending.data }
  },
  component: RegistrationRoute,
})

function RegistrationRoute() {
  const { plan } = Route.useSearch()
  const { plans, pending } = Route.useLoaderData()
  const queryClient = useQueryClient()
  const router = useRouter()
  return <RegistrationPage initialPlan={plan} initialPending={pending} catalog={plans} onComplete={async session => {
    queryClient.setQueryData(sessionQueryKey, { status: 'authenticated', me: session })
    await router.navigate({ to: '/admin' })
  }} />
}
