import { LogoutIcon } from '@solar-icons/react/linear'
import { Button, Text } from '@mantine/core'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { WasiyLogo } from '../../components/layout/shared/wasiy-logo'
import { formatDate } from '../../lib/dates'
import { getSubscription } from '../auth/access'
import { useLogout, useMe } from '../auth/hooks'

/**
 * The lock screen for staff who are not account admins once the Account has
 * lapsed (ADR 0039). Says what happened and who can fix it, nothing about
 * plans or prices: those belong to the admin-only subscription page.
 */
export function AccessPausedPage() {
  const { t } = useTranslation('common')
  const router = useRouter()
  const me = useMe().data
  const logoutMutation = useLogout()
  const subscription = me ? getSubscription(me) : null

  function handleLogout() {
    logoutMutation.mutate(undefined, { onSuccess: () => void router.navigate({ to: '/login' }) })
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--mantine-color-body)] px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-8 text-center">
        <div className="mx-auto mb-6 flex w-fit items-center gap-2 text-[var(--wa-brand-mark)]">
          <WasiyLogo size={26} />
          <span className="font-display text-lg font-semibold tracking-tight">Wasiy</span>
        </div>
        <h1 className="m-0 font-display text-2xl font-bold text-[var(--mantine-color-text)]">{t('subscription.pausedTitle')}</h1>
        <Text c="dimmed" mt={12}>
          {subscription
            ? t('subscription.pausedSince', { account: me?.active_account?.name, date: formatDate(subscription.access_until) })
            : t('subscription.pausedSinceUnknown', { account: me?.active_account?.name })}
        </Text>
        <Text mt={8}>{t('subscription.bannerLapsedBodyStaff')}</Text>
        <Button
          className="mt-8"
          disabled={logoutMutation.isPending}
          leftSection={<LogoutIcon aria-hidden="true" size={16} />}
          onClick={handleLogout}
          variant="default"
        >
          {t('auth.logout')}
        </Button>
      </div>
    </main>
  )
}
