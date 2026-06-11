import { Alert, Button, Loader } from '@mantine/core'
import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../lib/errors'

export function RoutePendingFallback() {
  const { t } = useTranslation('common')

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--background)]">
      <Loader aria-label={t('common.loading')} />
    </div>
  )
}

export function RouteErrorFallback({ error }: ErrorComponentProps) {
  const { t } = useTranslation('common')
  const router = useRouter()

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md">
        <Alert color="red" title={t('router.errorTitle')}>
          <p>{getErrorMessage(error)}</p>
          <Button
            className="mt-3"
            onClick={() => void router.invalidate()}
            variant="default"
          >
            {t('router.retry')}
          </Button>
        </Alert>
      </div>
    </main>
  )
}

export function RouteNotFoundFallback() {
  const { t } = useTranslation('common')

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {t('router.notFoundTitle')}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {t('router.notFoundBody')}
        </p>
        <Button className="mt-5" component={Link} to="/" variant="default">
          {t('router.goHome')}
        </Button>
      </div>
    </main>
  )
}
