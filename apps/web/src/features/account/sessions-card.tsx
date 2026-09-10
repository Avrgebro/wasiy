import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Skeleton } from '@mantine/core'
import { MonitorIcon, SmartphoneIcon } from '@solar-icons/react/linear'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { FormPasswordInput } from '../../components/ui/form-fields'
import { formatRelative } from '../../lib/dates'
import { submitHandlingServerErrors } from '../../lib/errors'
import { AccountCard, InlineSuccess } from './account-card'
import { closeOtherSessions, getSessions, type AccountSession } from './api'
import { currentPasswordSchema, type CurrentPasswordFormValues } from './schemas'
import { StatusPill } from '../../components/ui/chips'

const sessionsQueryKey = ['auth', 'sessions'] as const

/** "Sesiones activas" (mockup 21): where the account is open now, and the one way out for the rest. */
export function SessionsCard() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const sessions = useQuery({ queryKey: sessionsQueryKey, queryFn: getSessions, select: (r) => r.data })
  const [confirming, setConfirming] = useState(false)
  const [closed, setClosed] = useState(false)
  const form = useForm<CurrentPasswordFormValues>({ defaultValues: { current_password: '' }, resolver: zodResolver(currentPasswordSchema) })
  const mutation = useMutation({
    mutationFn: closeOtherSessions,
    onSuccess: async () => {
      form.reset(); setConfirming(false); setClosed(true)
      await queryClient.invalidateQueries({ queryKey: sessionsQueryKey })
    },
    meta: { suppressErrorNotification: true },
  })
  const others = (sessions.data ?? []).filter((session) => !session.is_current).length

  return (
    <AccountCard description={t('account.sessions.hint')} title={t('account.sessions.title')}>
      <ul className="m-0 flex list-none flex-col divide-y divide-[var(--mantine-color-default-border)] overflow-hidden rounded-inner border border-[var(--mantine-color-default-border)] p-0">
        {sessions.isPending ? <li className="p-3"><Skeleton height={32} /></li> : null}
        {(sessions.data ?? []).map((session) => <SessionRow key={session.id} session={session} />)}
      </ul>

      <div className="mt-4 flex flex-col gap-3">
        {confirming ? (
          <form className="flex flex-col gap-3" noValidate onSubmit={form.handleSubmit((values) => submitHandlingServerErrors(form, () => mutation.mutateAsync(values)))}>
            <FormPasswordInput autoComplete="current-password" control={form.control} label={t('account.password.current')} name="current_password" />
            {form.formState.errors.root?.message ? <p className="m-0 text-sm text-[var(--wa-error)]" role="alert">{form.formState.errors.root.message}</p> : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button color="error" loading={mutation.isPending} type="submit">{t('account.sessions.closeOthersConfirm')}</Button>
              <Button onClick={() => { form.reset(); setConfirming(false) }} variant="default">{t('actions.cancel')}</Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button className="w-full sm:w-auto" disabled={others === 0} onClick={() => { setClosed(false); setConfirming(true) }} variant="default">
              {t('account.sessions.closeOthers')}
            </Button>
            {closed ? <InlineSuccess>{t('account.sessions.closed')}</InlineSuccess> : null}
          </div>
        )}
      </div>
    </AccountCard>
  )
}

function SessionRow({ session }: { session: AccountSession }) {
  const { t } = useTranslation('common')
  const Icon = /iPhone|iPad|Android/.test(session.device) ? SmartphoneIcon : MonitorIcon

  return (
    <li className="flex min-h-14 items-center gap-3 px-3.5 py-2.5">
      <Icon aria-hidden="true" className="shrink-0 text-[var(--mantine-color-dimmed)]" size={18} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--mantine-color-text)]">{session.device}</span>
          {session.is_current ? <StatusPill color="teal">{t('account.sessions.current')}</StatusPill> : null}
        </div>
        <p className="m-0 mt-0.5 text-xs text-[var(--mantine-color-dimmed)]">
          {[session.ip_address, session.is_current ? t('account.sessions.activeNow') : t('account.sessions.lastActive', { when: formatRelative(session.last_active_at) })].filter(Boolean).join(' · ')}
        </p>
      </div>
    </li>
  )
}
