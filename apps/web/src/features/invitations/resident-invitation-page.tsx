import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useClaimResidentInvitation, useResidentInvitation } from './hooks'
import {
  InvitationLoading,
  InvitationShell,
  InvitationUnavailable,
} from './invitation-shell'
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

      await navigate({ to: postInvitationRoute(result.session) })
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
        <h1 className="text-2xl font-bold text-[var(--mantine-color-text)]">
          {t('invitations.residentTitle')}
        </h1>
        <p className="mt-2 text-sm text-[var(--mantine-color-dimmed)]">
          {t('invitations.residentIntro', {
            account: invitation.account.name,
            name: invitation.resident.name,
          })}
        </p>
        <div className="mt-5 grid gap-4">
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
          />
          <FormPasswordInput
            autoComplete="new-password"
            control={form.control}
            label={t('invitations.confirmPassword')}
            name="passwordConfirmation"
          />
          <Button loading={claimMutation.isPending} type="submit">
            {t('invitations.activateAccess')}
          </Button>
        </div>
      </form>
    </InvitationShell>
  )
}
