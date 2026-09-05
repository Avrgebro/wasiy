import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Badge, Button, Loader, Switch } from '@mantine/core'
import { notifySuccess } from '../../lib/notify'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { sessionQueryKey } from '../auth/query-options'
import type { MeResponse, Session } from '../auth/types'
import { FormPhoneInput } from '../../components/ui/phone-input'
import { ALERT_FAMILIES, getPortalResident, updatePortalEmailAlerts, updatePortalResidentPhone, type AlertFamily, type EmailAlertPreferences } from './api'
import {
  portalPhoneSchema,
  type PortalPhoneFormValues,
} from './schemas'
import { submitHandlingServerErrors } from '../../lib/errors'
import { useMe } from '../auth/hooks'

/** Perfil (P1, 03c): the household list, the contact phone and which alerts also reach the inbox; email and password arrive in P4. */
export function PortalProfilePage() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const meQuery = useMe()
  const memberships = meQuery.data?.resident_memberships ?? []
  const primaryMembership = memberships.find(
    (membership) => membership.is_primary_contact,
  )
  const phoneMutation = useMutation({
    mutationFn: (values: PortalPhoneFormValues) =>
      updatePortalResidentPhone(values.phone === '' ? null : values.phone),
    onSuccess: (resident) => {
      queryClient.setQueryData<Session>(sessionQueryKey, (session) => {
        if (session?.status !== 'authenticated') {
          return session
        }

        const me: MeResponse = {
          ...session.me,
          user: {
            ...session.me.user,
            first_name: resident.first_name,
            last_name: resident.last_name,
            name: resident.name,
          },
        }

        return { status: 'authenticated', me }
      })

      notifySuccess(t('portal.phoneSaved'), t('portal.phoneSavedTitle'))
    },
  })
  const resident = useQuery({ queryKey: ['portal', 'resident'], queryFn: getPortalResident })
  const preferences = resident.data?.email_alerts
  const emailAlerts = useMutation({
    mutationFn: updatePortalEmailAlerts,
    onSuccess: (updated) => {
      queryClient.setQueryData(['portal', 'resident'], updated)
    },
  })

  function toggle(family: AlertFamily, on: boolean) {
    if (!preferences) return
    const next: EmailAlertPreferences = { ...preferences, [family]: on }
    // Optimistic: the switch moves now, the server confirms or the query refetches.
    queryClient.setQueryData(['portal', 'resident'], { ...resident.data, email_alerts: next })
    emailAlerts.mutate(next, { onError: () => void queryClient.invalidateQueries({ queryKey: ['portal', 'resident'] }) })
  }

  const form = useForm<PortalPhoneFormValues>({
    defaultValues: {
      phone: '',
    },
    resolver: zodResolver(portalPhoneSchema),
  })

  async function handleSubmit(values: PortalPhoneFormValues) {
    await submitHandlingServerErrors(form, async () => {
      await phoneMutation.mutateAsync(values)
      form.reset(values)
    })
  }

  if (meQuery.isLoading) {
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader aria-label={t('common.loading')} />
      </div>
    )
  }

  const rootError = form.formState.errors.root?.message

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-2xl font-bold text-[var(--mantine-color-text)]">
            {t('portal.tabs.profile')}
          </h1>
          <p className="mt-1 text-sm text-[var(--mantine-color-dimmed)]">
            {primaryMembership
              ? t('portal.primaryUnit', {
                  unit: primaryMembership.unit_label,
                })
              : t('portal.summary')}
          </p>
        </div>
        <Badge color="success" variant="light">
          {t('portal.accessEnabled')}
        </Badge>
      </section>

      <section className="grid gap-4">
        <div className="rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-4">
          <h2 className="text-base font-bold text-[var(--mantine-color-text)]">
            {t('portal.householdTitle')}
          </h2>
          <div className="mt-4 grid gap-3">
            {memberships.map((membership) => (
              <div
                className="rounded-inner border border-[var(--mantine-color-default-border)] p-3"
                key={membership.unit_membership_id}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--mantine-color-text)]">
                      {membership.unit_label}
                    </p>
                  </div>
                  {membership.is_primary_contact ? (
                    <Badge variant="light">{t('portal.primaryContact')}</Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <form
          className="rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-4"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <h2 className="text-base font-bold text-[var(--mantine-color-text)]">
            {t('portal.phoneTitle')}
          </h2>
          <p className="mt-1 text-sm text-[var(--mantine-color-dimmed)]">
            {t('portal.phoneSummary')}
          </p>
          <div className="mt-4 grid gap-4">
            {rootError ? (
              <Alert color="error" title={t('errors.actionFailed')}>
                {rootError}
              </Alert>
            ) : null}
            <FormPhoneInput
              control={form.control}
              defaultCountry={memberships[0]?.country ?? 'PE'}
              label={t('portal.phone')}
              name="phone"
              placeholder="987 654 321"
            />
            <Button loading={phoneMutation.isPending} type="submit">
              {t('portal.savePhone')}
            </Button>
          </div>
        </form>

        <section className="rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-4">
          <h2 className="text-base font-bold text-[var(--mantine-color-text)]">
            {t('portal.alerts.preferences.title')}
          </h2>
          <p className="mt-1 text-sm text-[var(--mantine-color-dimmed)]">
            {t('portal.alerts.preferences.hint')}
          </p>
          <div className="mt-4 flex flex-col gap-1">
            {ALERT_FAMILIES.map((family) => (
              <Switch
                key={family}
                checked={preferences?.[family] ?? true}
                classNames={{ body: 'flex-row-reverse justify-between', labelWrapper: 'flex-1' }}
                color="accent"
                description={t(`portal.alerts.preferences.${family}Hint`)}
                disabled={!preferences}
                label={t(`portal.alerts.preferences.${family}`)}
                py="xs"
                onChange={(event) => toggle(family, event.currentTarget.checked)}
              />
            ))}
          </div>
          {resident.data?.login_email ? (
            <p className="mt-3 mb-0 text-xs text-[var(--mantine-color-dimmed)]">
              {t('portal.alerts.preferences.emailLine', { email: resident.data.login_email })}
            </p>
          ) : null}
        </section>
      </section>
    </div>
  )
}
