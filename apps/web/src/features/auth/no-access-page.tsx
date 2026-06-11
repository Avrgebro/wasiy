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

  async function handleLogout() {
    await logoutMutation.mutateAsync()
    await router.navigate({ to: '/login' })
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-4 py-8">
      <section className="w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--card)] p-5">
        <Brand />
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {t('auth.noAccessTitle')}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            {t('auth.noAvailableSurface')}
          </p>
        </div>
        <div className="mt-5">
          <Button
            fullWidth
            leftSection={<Logout size={16} />}
            loading={logoutMutation.isPending}
            onClick={() => void handleLogout()}
            variant="subtle"
          >
            {t('auth.logout')}
          </Button>
        </div>
      </section>
    </main>
  )
}
