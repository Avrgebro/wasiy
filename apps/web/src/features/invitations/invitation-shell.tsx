import { Anchor, Button, Loader, type ButtonProps } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../app/api-client'
import { WasiyLogo } from '../../components/layout/shared/wasiy-logo'
import { getErrorMessage } from '../../lib/errors'

const MARKETING_URL = import.meta.env.VITE_MARKETING_URL as string

/**
 * Page layout shared by both invitation surfaces. Recipients arrive from a
 * branded email with no session, so this renders outside the authenticated
 * shell and borrows the login/registration look: brand font, mark on top,
 * one centered card, quiet footer links.
 */
export function InvitationShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('common')

  return (
    <main className="flex min-h-screen flex-col items-center bg-[var(--mantine-color-body)] px-5 py-10 font-brand text-[var(--mantine-color-text)] [--mantine-font-family:var(--font-brand)] sm:py-14">
      <a
        aria-label="Wasiy, inicio"
        className="flex items-center gap-2.5 text-[var(--wa-brand-mark)] no-underline"
        href={MARKETING_URL}
      >
        <WasiyLogo className="shrink-0" size={28} />
        <span className="font-display text-xl font-semibold tracking-tight text-[var(--mantine-color-text)]">Wasiy</span>
      </a>

      <div className="mt-8 w-full max-w-[460px] rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-6 sm:mt-10 sm:p-8">
        {children}
      </div>

      <div className="mt-auto flex justify-center gap-[18px] pt-10 text-xs text-[var(--mantine-color-placeholder)]">
        <span>{t('auth.footerPrivacy')}</span>
        <span>{t('auth.footerTerms')}</span>
        <span>{t('auth.footerSupport')}</span>
      </div>
    </main>
  )
}

/** Title + lead used by every state of the card. */
export function InvitationHeader({ children, title }: { children?: React.ReactNode; title: React.ReactNode }) {
  return (
    <div>
      <h1 className="m-0 font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-[var(--mantine-color-text)]">{title}</h1>
      {children ? <p className="mt-2 text-[15px] leading-relaxed text-[var(--mantine-color-dimmed)]">{children}</p> : null}
    </div>
  )
}

/** Primary action sized like the login button. */
export function InvitationSubmit(props: ButtonProps & { onClick?: () => void; type?: 'button' | 'submit' }) {
  return <Button color="accent" fullWidth h={48} radius={10} styles={{ label: { fontSize: 15, fontWeight: 600 } }} {...props} />
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
 * A 410 means the token is spent, cancelled, or past its expiry — all
 * terminal. The reader may not have an account yet, so instead of a login
 * button the state points them back to whoever invited them.
 */
export function InvitationUnavailable({ error }: { error: unknown }) {
  const { t } = useTranslation('common')
  const isGone = error instanceof ApiError && error.status === 410

  return (
    <InvitationShell>
      <InvitationHeader title={isGone ? t('invitations.unavailableTitle') : t('errors.loadFailed')}>
        {isGone ? t('invitations.unavailableBody') : getErrorMessage(error)}
      </InvitationHeader>
      <p className="mt-6 text-sm text-[var(--mantine-color-dimmed)]">
        {t('invitations.alreadyHaveAccess')}{' '}
        <Anchor fw={600} fz="sm" href="/login">
          {t('auth.login')}
        </Anchor>
      </p>
    </InvitationShell>
  )
}
