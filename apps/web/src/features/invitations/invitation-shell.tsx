import { Button, Loader } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../app/api-client'
import { getErrorMessage } from '../../lib/errors'

/**
 * Card layout shared by both invitation surfaces. Recipients arrive with no
 * session, so these pages render outside the authenticated shell.
 */
export function InvitationShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm rounded-md border border-[var(--border)] bg-[var(--card)] p-5">
        {children}
      </div>
    </main>
  )
}

export function InvitationLoading() {
  return (
    <InvitationShell>
      <div className="grid place-items-center py-6">
        <Loader size="sm" />
      </div>
    </InvitationShell>
  )
}

/**
 * A 410 means the token is spent, cancelled, or past its expiry — all terminal,
 * so this state offers sign-in rather than a retry.
 */
export function InvitationUnavailable({ error }: { error: unknown }) {
  const { t } = useTranslation('common')
  const isGone = error instanceof ApiError && error.status === 410

  return (
    <InvitationShell>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        {isGone ? t('invitations.unavailableTitle') : t('errors.loadFailed')}
      </h1>
      <p className="mt-3 text-sm text-[var(--muted-foreground)]">
        {isGone ? t('invitations.unavailableBody') : getErrorMessage(error)}
      </p>
      <Button className="mt-5" component={Link} to="/login" variant="light">
        {t('auth.login')}
      </Button>
    </InvitationShell>
  )
}
