import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { StaffInvitationAcceptResult, StaffInvitationDetails } from './api'
import { useAcceptStaffInvitation, useStaffInvitation } from './hooks'
import {
  InvitationHeader,
  InvitationLoading,
  InvitationShell,
  InvitationSubmit,
  InvitationUnavailable,
} from './invitation-shell'
import { postInvitationRoute } from './post-invitation-route'
import {
  createStaffAccountSchema,
  type CreateStaffAccountFormValues,
} from './schemas'
import { ApiError } from '../../app/api-client'
import { FormPasswordInput, FormTextInput } from '../../components/ui/form-fields'
import { formatDate } from '../../lib/dates'
import { getErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifyWarning } from '../../lib/notify'
import { getRoleLabelKey } from '../auth/access'
import { authFieldStyles } from '../auth/auth-field-styles'
import { useLogout, useSession } from '../auth/hooks'

export function StaffInvitationPage({ token }: { token: string }) {
  const invitationQuery = useStaffInvitation(token)
  const sessionQuery = useSession()

  if (invitationQuery.isPending || sessionQuery.isPending) {
    return <InvitationLoading />
  }

  if (invitationQuery.isError) {
    return <InvitationUnavailable error={invitationQuery.error} />
  }

  const invitation = invitationQuery.data
  const session = sessionQuery.data
  const signedInEmail = session?.status === 'authenticated' ? session.me.user.email : null

  // Someone else's session is open on this browser. Whatever mode the
  // invitation would take, the API refuses to act under that session, so
  // the invitee ends it first. The session probe failing outright (network,
  // 5xx) settles nothing; the modes then let the API have the final word.
  if (signedInEmail !== null && signedInEmail.toLowerCase() !== invitation.email.toLowerCase()) {
    return <WrongAccountMode invitation={invitation} signedInEmail={signedInEmail} token={token} />
  }

  return invitation.requires_account_creation ? (
    <CreateAccountMode invitation={invitation} token={token} />
  ) : (
    <ConfirmJoinMode invitation={invitation} signedInEmail={signedInEmail} token={token} />
  )
}

/** Signs the current person out and returns to this page through /login. */
function useSignInAsInvitee(token: string) {
  const navigate = useNavigate()
  const logoutMutation = useLogout()

  return {
    pending: logoutMutation.isPending,
    async run() {
      await logoutMutation.mutateAsync().catch(() => undefined)
      await navigate({ to: '/login', search: { redirect: `/invitations/staff/${token}` } })
    },
  }
}

/**
 * The browser holds a session for a different email than the invited one.
 * Shown before either mode, and again by the confirm mode if the API says
 * the session changed underneath it (409).
 */
function WrongAccountMode({
  invitation,
  signedInEmail,
  token,
}: {
  invitation: StaffInvitationDetails
  signedInEmail: string | null
  token: string
}) {
  const { t } = useTranslation('common')
  const signIn = useSignInAsInvitee(token)

  return (
    <InvitationShell>
      <InvitationHeading invitation={invitation} />
      <div className="mt-6 grid gap-4">
        <Alert color="warning" title={t('invitations.wrongAccountTitle')}>
          {signedInEmail
            ? t('invitations.wrongAccountBodySignedInAs', { email: invitation.email, current: signedInEmail })
            : t('invitations.wrongAccountBody', { email: invitation.email })}
        </Alert>
        <InvitationSubmit loading={signIn.pending} onClick={signIn.run}>
          {t('invitations.signInAs', { email: invitation.email })}
        </InvitationSubmit>
      </div>
    </InvitationShell>
  )
}

/**
 * The accept succeeded but a location named in the invitation was removed
 * in the meantime; the API grants the rest and reports what it dropped.
 * The person is about to land in the app, so the notice travels with them.
 */
function warnAboutSkippedLocations(result: StaffInvitationAcceptResult, t: (key: string, options?: Record<string, unknown>) => string) {
  if (result.skipped_location_ids.length > 0) {
    notifyWarning(t('invitations.skippedLocations', { count: result.skipped_location_ids.length }))
  }
}

/**
 * Shown when no User exists for the invited address yet.
 */
function CreateAccountMode({
  invitation,
  token,
}: {
  invitation: StaffInvitationDetails
  token: string
}) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const acceptMutation = useAcceptStaffInvitation()
  const form = useForm<CreateStaffAccountFormValues>({
    defaultValues: {
      firstName: invitation.first_name,
      lastName: invitation.last_name,
      password: '',
      passwordConfirmation: '',
    },
    resolver: zodResolver(createStaffAccountSchema),
  })

  const rootError = form.formState.errors.root?.message

  async function handleSubmit(values: CreateStaffAccountFormValues) {
    await submitHandlingServerErrors(form, async () => {
      const result = await acceptMutation.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        password: values.password,
        passwordConfirmation: values.passwordConfirmation,
        token,
      })

      warnAboutSkippedLocations(result, t)
      await navigate({ href: postInvitationRoute(result.session, 'admin') })
    })
  }

  return (
    <InvitationShell>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <InvitationHeading invitation={invitation} />
        <div className="mt-6 grid gap-4">
          {rootError ? (
            <Alert color="error" title={t('invitations.acceptFailed')}>
              {rootError}
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormTextInput
              autoComplete="given-name"
              control={form.control}
              label={t('invitations.firstName')}
              name="firstName"
              styles={authFieldStyles}
            />
            <FormTextInput
              autoComplete="family-name"
              control={form.control}
              label={t('invitations.lastName')}
              name="lastName"
              styles={authFieldStyles}
            />
          </div>
          <FormPasswordInput
            autoComplete="new-password"
            control={form.control}
            label={t('invitations.newPassword')}
            name="password"
            placeholder={t('invitations.passwordPlaceholder')}
            styles={authFieldStyles}
          />
          <FormPasswordInput
            autoComplete="new-password"
            control={form.control}
            label={t('invitations.confirmPassword')}
            name="passwordConfirmation"
            styles={authFieldStyles}
          />
          <InvitationSubmit loading={acceptMutation.isPending} type="submit">
            {t('invitations.acceptInvitation')}
          </InvitationSubmit>
          <p className="m-0 text-center text-[13px] text-[var(--mantine-color-dimmed)]">
            {t('invitations.accountEmail', { email: invitation.email })}
          </p>
        </div>
      </form>
    </InvitationShell>
  )
}

/**
 * Shown when the invited address already has an account and the browser
 * holds either no session or the invitee's own. Anonymous visitors are sent
 * to sign in; a matching session confirms in one click. The 401/409
 * branches are a backstop for a session that changes between render and
 * click.
 */
function ConfirmJoinMode({
  invitation,
  signedInEmail,
  token,
}: {
  invitation: StaffInvitationDetails
  signedInEmail: string | null
  token: string
}) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const acceptMutation = useAcceptStaffInvitation()
  const signIn = useSignInAsInvitee(token)
  const [error, setError] = useState<unknown>(null)

  const status = error instanceof ApiError ? error.status : null

  if (status === 409) {
    return <WrongAccountMode invitation={invitation} signedInEmail={null} token={token} />
  }

  const state = status === 401 || signedInEmail === null ? 'sign-in' : 'confirm'

  async function handleAccept() {
    setError(null)

    try {
      const result = await acceptMutation.mutateAsync({ token })

      warnAboutSkippedLocations(result, t)
      await navigate({ href: postInvitationRoute(result.session, 'admin') })
    } catch (caught) {
      setError(caught)
    }
  }

  return (
    <InvitationShell>
      <InvitationHeading invitation={invitation} />
      <div className="mt-6 grid gap-4">
        {state === 'sign-in' ? (
          <Alert color="info" title={t('invitations.signInRequiredTitle')}>
            {t('invitations.signInRequiredBody', { email: invitation.email })}
          </Alert>
        ) : null}
        {error !== null && state === 'confirm' ? (
          <Alert color="error" title={t('invitations.acceptFailed')}>
            {getErrorMessage(error)}
          </Alert>
        ) : null}

        {state === 'confirm' ? (
          <>
            <InvitationSubmit loading={acceptMutation.isPending} onClick={handleAccept}>
              {t('invitations.acceptInvitation')}
            </InvitationSubmit>
            <p className="m-0 text-center text-[13px] text-[var(--mantine-color-dimmed)]">
              {t('invitations.acceptingAs', { email: signedInEmail })}
            </p>
          </>
        ) : (
          <InvitationSubmit loading={signIn.pending} onClick={signIn.run}>
            {t('invitations.signInAs', { email: invitation.email })}
          </InvitationSubmit>
        )}
      </div>
    </InvitationShell>
  )
}

function InvitationHeading({
  invitation,
}: {
  invitation: StaffInvitationDetails
}) {
  const { t } = useTranslation('common')

  return (
    <>
      <InvitationHeader title={t('invitations.staffTitle', { account: invitation.account.name })}>
        {invitation.invited_by.name
          ? t('invitations.staffIntroByInviter', {
              account: invitation.account.name,
              inviter: invitation.invited_by.name,
            })
          : t('invitations.staffIntro', { account: invitation.account.name })}
      </InvitationHeader>
      <ul className="mt-4 grid list-none gap-2 p-0">
        {invitation.roles.account_role ? (
          <AccessRow label={t(getRoleLabelKey(invitation.roles.account_role))} detail={t('staff.accountAdminHint')} />
        ) : null}
        {invitation.roles.locations.map((location) => (
          <AccessRow key={`${location.name}-${location.role}`} label={location.name} detail={t(getRoleLabelKey(location.role))} />
        ))}
      </ul>
      {invitation.expires_at ? (
        <p className="mt-4 text-[13px] text-[var(--mantine-color-dimmed)]">
          {t('invitations.expiresOn', { date: formatDate(invitation.expires_at) })}
        </p>
      ) : null}
    </>
  )
}

/** One granted access: where on the left, which role on the right. */
function AccessRow({ detail, label }: { detail: string; label: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-[var(--wa-surface-2)] px-3.5 py-2.5 text-sm">
      <span className="min-w-0 truncate font-semibold">{label}</span>
      <span className="shrink-0 text-[var(--mantine-color-dimmed)]">{detail}</span>
    </li>
  )
}
