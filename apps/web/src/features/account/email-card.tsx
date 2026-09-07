import { zodResolver } from '@hookform/resolvers/zod'
import { Badge, Button, PinInput } from '@mantine/core'
import { ShieldCheckIcon } from '@solar-icons/react/linear'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../app/api-client'
import { FormPasswordInput, FormTextInput } from '../../components/ui/form-fields'
import { submitHandlingServerErrors } from '../../lib/errors'
import { sessionQueryOptions } from '../auth/query-options'
import type { AuthUser } from '../auth/types'
import { AccountCard, InlineSuccess } from './account-card'
import { cancelEmailChange, getEmailChange, requestEmailChange, resendEmailChange, verifyEmailChange, type PendingEmailChange } from './api'
import { emailChangeSchema, type EmailChangeFormValues } from './schemas'

const pendingKey = ['auth', 'email-change'] as const

/**
 * "Correo de acceso" (mockup 21): read-only until "Cambiar correo", then the
 * card expands in place. Step 1 asks the current password and the new
 * address; step 2 the 6-digit code sent there. The login email only changes
 * when the code is confirmed; a reopened tab resumes on step 2.
 */
export function EmailCard({ user }: { user: AuthUser }) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const pendingQuery = useQuery({ queryKey: pendingKey, queryFn: getEmailChange, select: (r) => r.data })
  const pending = pendingQuery.data ?? null
  const [editing, setEditing] = useState(false)
  const [changed, setChanged] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  // The resend cooldown is derived, not stored: it ends `resend_after`
  // seconds after the pending state was last fetched or written.
  const [now, setNow] = useState(() => Date.now())
  const cooldownEndsAt = pending ? pendingQuery.dataUpdatedAt + pending.resend_after * 1000 : 0
  const cooldown = pending ? Math.min(pending.resend_after, Math.max(0, Math.ceil((cooldownEndsAt - now) / 1000))) : 0
  useEffect(() => {
    if (!cooldown) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const form = useForm<EmailChangeFormValues>({ defaultValues: { current_password: '', email: '' }, resolver: zodResolver(emailChangeSchema) })
  const setPending = (next: PendingEmailChange | null) => queryClient.setQueryData(pendingKey, { data: next })

  const request = useMutation({
    mutationFn: requestEmailChange,
    onSuccess: ({ data }) => { form.reset(); setCode(''); setCodeError(''); setPending(data) },
    meta: { suppressErrorNotification: true },
  })
  const resend = useMutation({
    mutationFn: resendEmailChange,
    onSuccess: ({ data }) => { setCode(''); setCodeError(''); setPending(data) },
    meta: { suppressErrorNotification: true },
  })
  const verify = useMutation({
    mutationFn: verifyEmailChange,
    onSuccess: async () => {
      setPending(null); setEditing(false); setChanged(true); setCode('')
      await queryClient.fetchQuery({ ...sessionQueryOptions(), staleTime: 0 })
    },
    onError: (error) => {
      const messages = error instanceof ApiError ? error.errors?.code : undefined
      if (error instanceof ApiError && error.status === 410) { setPending(null); setEditing(true); return }
      setCodeError(messages?.join(' ') ?? t('errors.actionFailed'))
    },
    meta: { suppressErrorNotification: true },
  })
  const cancel = useMutation({
    mutationFn: cancelEmailChange,
    onSuccess: () => { setPending(null); setEditing(false); setCode(''); setCodeError('') },
  })

  function submitCode(event: FormEvent) {
    event.preventDefault()
    if (code.length === 6) verify.mutate(code)
  }

  const step = pending ? 2 : editing ? 1 : 0
  const busy = request.isPending || resend.isPending || verify.isPending || cancel.isPending

  return (
    <AccountCard
      actions={step === 0 ? <Button disabled={pendingQuery.isPending} onClick={() => { setChanged(false); setEditing(true) }} variant="default">{t('account.email.change')}</Button> : <span className="text-xs font-semibold text-[var(--mantine-color-dimmed)]">{t('account.email.step', { step })}</span>}
      description={step === 0 ? t('account.email.hint') : undefined}
      title={t('account.email.title')}
    >
      {step === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-[var(--mantine-color-text)] [overflow-wrap:anywhere]">{user.email}</span>
            <Badge color="success" leftSection={<ShieldCheckIcon aria-hidden="true" size={11} />} radius="xl" size="sm" variant="light">{t('account.email.verified')}</Badge>
          </div>
          {changed ? <InlineSuccess>{t('account.email.changed')}</InlineSuccess> : null}
        </div>
      ) : null}

      {step === 1 ? (
        <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((values) => submitHandlingServerErrors(form, () => request.mutateAsync(values)))}>
          <FormPasswordInput autoComplete="current-password" control={form.control} label={t('account.password.current')} name="current_password" />
          <FormTextInput autoComplete="email" control={form.control} label={t('account.email.new')} name="email" placeholder="nombre@empresa.pe" type="email" />
          {form.formState.errors.root?.message ? <p className="m-0 text-sm text-[var(--wa-error)]" role="alert">{form.formState.errors.root.message}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button color="accent" loading={request.isPending} type="submit">{t('account.email.sendCode')}</Button>
            <Button disabled={busy} onClick={() => { form.reset(); setEditing(false) }} variant="default">{t('actions.cancel')}</Button>
          </div>
          <p className="m-0 text-xs text-[var(--mantine-color-dimmed)]">{t('account.email.nothingChangesYet')}</p>
        </form>
      ) : null}

      {step === 2 && pending ? (
        <form className="flex flex-col gap-4" onSubmit={submitCode}>
          <p className="m-0 text-sm text-[var(--mantine-color-dimmed)] [overflow-wrap:anywhere]">
            {t('account.email.codeSentTo')} <strong className="text-[var(--mantine-color-text)]">{pending.email}</strong>. {t('account.email.changesOnConfirm')}
          </p>
          <div aria-label={t('account.email.codeLabel')} role="group">
            <PinInput
              ariaLabel={t('account.email.codeDigit')}
              autoFocus
              disabled={busy}
              error={!!codeError}
              gap={6}
              getInputProps={(index) => ({ 'aria-label': t('account.email.codeDigitN', { n: index + 1 }), 'aria-describedby': codeError ? 'account-code-error' : undefined })}
              length={6}
              oneTimeCode
              onChange={(value) => { setCode(value); setCodeError('') }}
              placeholder=""
              radius={10}
              size="md"
              styles={{ input: { textAlign: 'center', padding: 0 } }}
              type="number"
              value={code}
            />
          </div>
          {codeError ? <p className="m-0 text-sm text-[var(--wa-error)]" id="account-code-error" role="alert">{codeError}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button color="accent" disabled={code.length !== 6} loading={verify.isPending} type="submit">{t('account.email.confirm')}</Button>
            <Button disabled={busy || cooldown > 0} onClick={() => resend.mutate()} variant="default">{cooldown ? t('account.email.resendIn', { seconds: cooldown }) : t('account.email.resend')}</Button>
            <Button disabled={busy} onClick={() => cancel.mutate()} variant="subtle">{t('actions.cancel')}</Button>
          </div>
          <p className="m-0 text-xs text-[var(--mantine-color-dimmed)] [overflow-wrap:anywhere]">{t('account.email.fallback', { email: user.email })}</p>
        </form>
      ) : null}
    </AccountCard>
  )
}
