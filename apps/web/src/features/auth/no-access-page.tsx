import { Button } from '@mantine/core'
import { Logout } from '@solar-icons/react'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { SURFACE } from '../../app/surface'
import { Brand } from '../../components/layout/shared/brand'
import { canAccessAdmin, canAccessPortal } from './access'
import { useLogout, useMe } from './hooks'

export function NoAccessPage() {
  const { t } = useTranslation('common')
  const router = useRouter()
  const logoutMutation = useLogout()
  const me = useMe().data
  // The other host, when this person belongs there (dev defaults in vite.config.ts).
  const otherHost =
    me && SURFACE === 'admin' && canAccessPortal(me)
      ? { href: import.meta.env.VITE_PORTAL_URL as string, hint: t('auth.noAccessResidentHint'), label: t('auth.goToPortal') }
      : me && SURFACE === 'portal' && canAccessAdmin(me)
        ? { href: import.meta.env.VITE_APP_URL as string, hint: t('auth.noAccessStaffHint'), label: t('auth.goToStaffApp') }
        : null

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => void router.navigate({ to: '/login' }),
    })
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--mantine-color-body)] px-4 py-8">
      <section className="w-full max-w-md rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-5">
        <Brand />
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-[var(--mantine-color-text)]">
            {t('auth.noAccessTitle')}
          </h1>
          <p className="mt-2 text-sm text-[var(--mantine-color-dimmed)]">
            {otherHost ? otherHost.hint : t('auth.noAvailableSurface')}
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {otherHost ? (
            <Button color="accent" component="a" fullWidth href={otherHost.href}>
              {otherHost.label}
            </Button>
          ) : null}
          <Button
            fullWidth
            leftSection={<Logout size={16} />}
            loading={logoutMutation.isPending}
            onClick={handleLogout}
            variant="subtle"
          >
            {t('auth.logout')}
          </Button>
        </div>
      </section>
    </main>
  )
}
