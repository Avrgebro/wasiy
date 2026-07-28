import { Button } from '@mantine/core'
import { Logout } from '@solar-icons/react'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useLogout } from './hooks'
import { Brand } from '../../components/layout/shared/brand'

export function NoAccessPage() {
  const { t } = useTranslation('common')
  const router = useRouter()
  const logoutMutation = useLogout()

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => void router.navigate({ to: '/login' }),
    })
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--mantine-color-body)] px-4 py-8">
      <section className="w-full max-w-md rounded-md border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-5">
        <Brand />
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-[var(--mantine-color-text)]">
            {t('auth.noAccessTitle')}
          </h1>
          <p className="mt-2 text-sm text-[var(--mantine-color-dimmed)]">
            {t('auth.noAvailableSurface')}
          </p>
        </div>
        <div className="mt-5">
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
