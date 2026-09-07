import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { FormTextInput } from '../../components/ui/form-fields'
import { submitHandlingServerErrors } from '../../lib/errors'
import { sessionQueryOptions } from '../auth/query-options'
import type { AuthUser } from '../auth/types'
import { AccountCard, InlineSuccess } from './account-card'
import { updateProfile } from './api'
import { profileSchema, type ProfileFormValues } from './schemas'

export function PersonalDataCard({ user }: { user: AuthUser }) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(false)
  const form = useForm<ProfileFormValues>({ defaultValues: { first_name: user.first_name, last_name: user.last_name }, resolver: zodResolver(profileSchema) })
  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async ({ data }) => {
      form.reset({ first_name: data.first_name, last_name: data.last_name })
      setSaved(true)
      // The topbar avatar, sidebar footer and menu all read the session.
      await queryClient.fetchQuery({ ...sessionQueryOptions(), staleTime: 0 })
    },
    meta: { suppressErrorNotification: true },
  })
  const rootError = form.formState.errors.root?.message

  return (
    <AccountCard title={t('account.personal.title')}>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((values) => { setSaved(false); return submitHandlingServerErrors(form, () => mutation.mutateAsync(values)) })}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormTextInput autoComplete="given-name" control={form.control} label={t('account.personal.firstName')} name="first_name" />
          <FormTextInput autoComplete="family-name" control={form.control} label={t('account.personal.lastName')} name="last_name" />
        </div>
        {rootError ? <p className="m-0 text-sm text-[var(--wa-error)]" role="alert">{rootError}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button className="w-full sm:w-auto" disabled={!form.formState.isDirty} loading={mutation.isPending} type="submit" variant="default">
            {t('actions.saveChanges')}
          </Button>
          {saved && !form.formState.isDirty ? <InlineSuccess>{t('account.personal.saved')}</InlineSuccess> : null}
        </div>
      </form>
    </AccountCard>
  )
}
