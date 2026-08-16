import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { StaffInvitationDetails } from './api'
import { useAcceptStaffInvitation, useStaffInvitation } from './hooks'
import {
  InvitationLoading,
  InvitationShell,
  InvitationUnavailable,
} from './invitation-shell'
import { postInvitationRoute } from './post-invitation-route'
import {
  createStaffAccountSchema,
  type CreateStaffAccountFormValues,
} from './schemas'
import { ApiError } from '../../app/api-client'
import { FormPasswordInput, FormTextInput } from '../../components/ui/form-fields'
import { getRoleLabelKey } from '../auth/access'
import { useLogout } from '../auth/hooks'
import { getErrorMessage, submitHandlingServerErrors } from '../../lib/errors'

export function StaffInvitationPage({ token }: { token: string }) {
  const invitationQuery = useStaffInvitation(token)

  if (invitationQuery.isPending) {
    return <InvitationLoading />
  }

  if (invitationQuery.isError) {
    return <InvitationUnavailable error={invitationQuery.error} />
  }

  return invitationQuery.data.requires_account_creation ? (
    <CreateAccountMode invitation={invitationQuery.data} token={token} />
  ) : (
    <ConfirmJoinMode invitation={invitationQuery.data} token={token} />
  )
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

      await navigate({ to: postInvitationRoute(result.session) })
    })
  }

  return (
    <InvitationShell>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <InvitationHeading invitation={invitation} />
        <div className="mt-5 grid gap-4">
          {rootError ? (
            <Alert color="red" title={t('invitations.acceptFailed')}>
              {rootError}
            </Alert>
          ) : null}
          <FormTextInput
            autoComplete="given-name"
            control={form.control}
            label={t('invitations.firstName')}
            name="firstName"
          />
          <FormTextInput
            autoComplete="family-name"
            control={form.control}
            label={t('invitations.lastName')}
            name="lastName"
          />
          <FormPasswordInput
            autoComplete="new-password"
            control={form.control}
            label={t('invitations.newPassword')}
            name="password"
          />
          <FormPasswordInput
            autoComplete="new-password"
            control={form.control}
            label={t('invitations.confirmPassword')}
            name="passwordConfirmation"
          />
          <Button loading={acceptMutation.isPending} type="submit">
            {t('invitations.acceptInvitation')}
          </Button>
        </div>
      </form>
    </InvitationShell>
  )
}

/**
 * Shown when the invited address already has an account. The backend requires
 * a session belonging to that address, so this mode handles the 401 (not
 * signed in) and 409 (signed in as someone else) responses.
 */
function ConfirmJoinMode({
  invitation,
  token,
}: {
  invitation: StaffInvitationDetails
  token: string
}) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const acceptMutation = useAcceptStaffInvitation()
  const logoutMutation = useLogout()
  const [error, setError] = useState<unknown>(null)

  const status = error instanceof ApiError ? error.status : null
  const needsRelogin = status === 401 || status === 409
  const returnTo = `/invitations/staff/${token}`

  async function goToLogin() {
    await logoutMutation.mutateAsync().catch(() => undefined)
    await navigate({ to: '/login', search: { redirect: returnTo } })
  }

  async function handleAccept() {
    setError(null)

    try {
      const result = await acceptMutation.mutateAsync({ token })

      await navigate({ to: postInvitationRoute(result.session) })
    } catch (caught) {
      setError(caught)
    }
  }

  return (
    <InvitationShell>
      <InvitationHeading invitation={invitation} />
      <div className="mt-5 grid gap-4">
        {status === 401 ? (
          <Alert color="blue" title={t('invitations.signInRequiredTitle')}>
            {t('invitations.signInRequiredBody', { email: invitation.email })}
          </Alert>
        ) : null}
        {status === 409 ? (
          <Alert color="orange" title={t('invitations.wrongAccountTitle')}>
            {t('invitations.wrongAccountBody', { email: invitation.email })}
          </Alert>
        ) : null}
        {error !== null && !needsRelogin ? (
          <Alert color="red" title={t('invitations.acceptFailed')}>
            {getErrorMessage(error)}
          </Alert>
        ) : null}

        {needsRelogin ? (
          <Button loading={logoutMutation.isPending} onClick={goToLogin}>
            {t('invitations.signInAs', { email: invitation.email })}
          </Button>
        ) : (
          <Button loading={acceptMutation.isPending} onClick={handleAccept}>
            {t('invitations.acceptInvitation')}
          </Button>
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
      <h1 className="text-2xl font-bold text-[var(--mantine-color-text)]">
        {t('invitations.staffTitle', { account: invitation.account.name })}
      </h1>
      <p className="mt-2 text-sm text-[var(--mantine-color-dimmed)]">
        {invitation.invited_by.name
          ? t('invitations.staffIntroByInviter', {
              account: invitation.account.name,
              inviter: invitation.invited_by.name,
            })
          : t('invitations.staffIntro', { account: invitation.account.name })}
      </p>
      <ul className="mt-3 grid gap-1 text-sm text-[var(--mantine-color-dimmed)]">
        {invitation.roles.account_role ? (
          <li>{t(getRoleLabelKey(invitation.roles.account_role))}</li>
        ) : null}
        {invitation.roles.locations.map((location) => (
          <li key={`${location.name}-${location.role}`}>
            {location.name} — {t(getRoleLabelKey(location.role))}
          </li>
        ))}
      </ul>
    </>
  )
}
