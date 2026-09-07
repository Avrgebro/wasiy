import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { FormPasswordInput } from '../../components/ui/form-fields'
import { submitHandlingServerErrors } from '../../lib/errors'
import { AccountCard, InlineSuccess } from './account-card'
import { changePassword } from './api'
import { passwordSchema, type PasswordFormValues } from './schemas'

export function PasswordCard() {
  const { t } = useTranslation('common')
  const [changed, setChanged] = useState(false)
  const form = useForm<PasswordFormValues>({ defaultValues: { current_password: '', password: '', password_confirmation: '' }, resolver: zodResolver(passwordSchema) })
  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => { form.reset(); setChanged(true) },
    meta: { suppressErrorNotification: true },
  })
  const rootError = form.formState.errors.root?.message

  return (
    <AccountCard title={t('account.password.title')}>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((values) => { setChanged(false); return submitHandlingServerErrors(form, () => mutation.mutateAsync(values)) })}>
        <FormPasswordInput autoComplete="current-password" control={form.control} label={t('account.password.current')} name="current_password" />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormPasswordInput autoComplete="new-password" control={form.control} description={t('account.password.minHint')} label={t('account.password.new')} name="password" />
          <FormPasswordInput autoComplete="new-password" control={form.control} label={t('account.password.confirm')} name="password_confirmation" />
        </div>
        {rootError ? <p className="m-0 text-sm text-[var(--wa-error)]" role="alert">{rootError}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button className="w-full sm:w-auto" color="accent" loading={mutation.isPending} type="submit">
            {t('account.password.submit')}
          </Button>
          {changed ? <InlineSuccess>{t('account.password.changed')}</InlineSuccess> : null}
        </div>
      </form>
    </AccountCard>
  )
}
