import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useClaimResidentInvitation, useResidentInvitation } from './hooks'
import {
  InvitationLoading,
  InvitationHeader,
  InvitationShell,
  InvitationSubmit,
  InvitationUnavailable,
} from './invitation-shell'
import { authFieldStyles } from '../auth/auth-field-styles'
import { postInvitationRoute } from './post-invitation-route'
import {
  claimInvitationSchema,
  type ClaimInvitationFormValues,
} from './schemas'
import { FormPasswordInput } from '../../components/ui/form-fields'
import { submitHandlingServerErrors } from '../../lib/errors'

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
    await submitHandlingServerErrors(form, async () => {
      const result = await claimMutation.mutateAsync({
        password: values.password,
        passwordConfirmation: values.passwordConfirmation,
        token,
      })

      await navigate({ href: postInvitationRoute(result.session, 'portal') })
    })
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
        <InvitationHeader title={t('invitations.residentTitle')}>
          {t('invitations.residentIntro', {
            account: invitation.account.name,
            name: invitation.resident.name,
          })}
        </InvitationHeader>
        <div className="mt-6 grid gap-4">
          {rootError ? (
            <Alert color="error" title={t('invitations.claimFailed')}>
              {rootError}
            </Alert>
          ) : null}
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
          <InvitationSubmit loading={claimMutation.isPending} type="submit">
            {t('invitations.activateAccess')}
          </InvitationSubmit>
          <p className="m-0 text-center text-[13px] text-[var(--mantine-color-dimmed)]">
            {t('invitations.accountEmail', { email: invitation.email })}
          </p>
        </div>
      </form>
    </InvitationShell>
  )
}
