import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, PasswordInput } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useClaimResidentInvitation, useResidentInvitation } from './hooks'
import {
  InvitationLoading,
  InvitationShell,
  InvitationUnavailable,
} from './invitation-shell'
import {
  claimInvitationSchema,
  type ClaimInvitationFormValues,
} from './schemas'
import { getDefaultAuthenticatedRoute } from '../auth/access'
import {
  applyLaravelValidationErrors,
  getErrorMessage,
} from '../../lib/errors'

export function ResidentInvitationPage({ token }: { token: string }) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const invitationQuery = useResidentInvitation(token)
  const claimMutation = useClaimResidentInvitation()
  const form = useForm<ClaimInvitationFormValues>({
    defaultValues: {
      password: '',
      passwordConfirmation: '',
    },
    resolver: zodResolver(claimInvitationSchema),
  })

  const rootError = form.formState.errors.root?.message

  async function handleSubmit(values: ClaimInvitationFormValues) {
    try {
      const result = await claimMutation.mutateAsync({
        password: values.password,
        passwordConfirmation: values.passwordConfirmation,
        token,
      })

      // Without a session the claim still succeeded, so send them to sign in
      // rather than into a surface they cannot load yet.
      await navigate({
        to: result.session
          ? getDefaultAuthenticatedRoute(result.session)
          : '/login',
      })
    } catch (error) {
      if (
        !applyLaravelValidationErrors<ClaimInvitationFormValues>(
          error,
          form.setError,
        )
      ) {
        form.setError('root', {
          message: getErrorMessage(error),
          type: 'server',
        })
      }
    }
  }

  if (invitationQuery.isPending) {
    return <InvitationLoading />
  }

  if (invitationQuery.isError) {
    return <InvitationUnavailable error={invitationQuery.error} />
  }

  const invitation = invitationQuery.data

  return (
    <InvitationShell>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {t('invitations.residentTitle')}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {t('invitations.residentIntro', {
            account: invitation.account.name,
            name: invitation.resident.name,
          })}
        </p>
        <div className="mt-5 grid gap-4">
          {rootError ? (
            <Alert color="red" title={t('invitations.claimFailed')}>
              {rootError}
            </Alert>
          ) : null}
          <Controller
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <PasswordInput
                {...field}
                autoComplete="new-password"
                error={
                  fieldState.error?.message
                    ? t(fieldState.error.message)
                    : undefined
                }
                label={t('invitations.newPassword')}
              />
            )}
          />
          <Controller
            control={form.control}
            name="passwordConfirmation"
            render={({ field, fieldState }) => (
              <PasswordInput
                {...field}
                autoComplete="new-password"
                error={
                  fieldState.error?.message
                    ? t(fieldState.error.message)
                    : undefined
                }
                label={t('invitations.confirmPassword')}
              />
            )}
          />
          <Button loading={claimMutation.isPending} type="submit">
            {t('invitations.activateAccess')}
          </Button>
        </div>
      </form>
    </InvitationShell>
  )
}
