import { Alert, Button, Loader } from '@mantine/core'
import { Logout } from '@solar-icons/react'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { getDefaultAuthenticatedRoute } from './access'
import { useLogout, useMe, useSelectAccount } from './hooks'
import { Brand } from '../../components/layout/shared/brand'
import { getErrorMessage } from '../../lib/errors'

export function SelectAccountPage() {
  const { t } = useTranslation('common')
  const router = useRouter()
  const meQuery = useMe()
  const logoutMutation = useLogout()
  const selectAccountMutation = useSelectAccount()

  function handleSelectAccount(accountId: string) {
    selectAccountMutation.mutate(accountId, {
      onSuccess: (me) =>
        void router.navigate({ to: getDefaultAuthenticatedRoute(me) }),
    })
  }

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => void router.navigate({ to: '/login' }),
    })
  }

  const error = selectAccountMutation.error

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-4 py-8">
      <section className="w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--card)] p-5">
        <Brand productAreaKey="accountSelection.productArea" />
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {t('accountSelection.title')}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            {t('accountSelection.summary')}
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          {meQuery.isLoading ? (
            <div className="grid min-h-24 place-items-center">
              <Loader aria-label={t('common.loading')} />
            </div>
          ) : null}

          {error ? (
            <Alert color="red" title={t('accountSelection.selectFailed')}>
              {getErrorMessage(error)}
            </Alert>
          ) : null}

          {meQuery.data?.accounts.map((account) => (
            <Button
              disabled={selectAccountMutation.isPending}
              fullWidth
              justify="space-between"
              key={account.id}
              loading={
                selectAccountMutation.isPending &&
                selectAccountMutation.variables === account.id
              }
              onClick={() => handleSelectAccount(account.id)}
              variant="default"
            >
              {account.name}
            </Button>
          ))}
        </div>

        <div className="mt-5 border-t border-[var(--border)] pt-4">
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
