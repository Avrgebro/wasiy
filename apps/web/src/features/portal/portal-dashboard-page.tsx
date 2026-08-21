import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Badge, Button, Loader, TextInput } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { sessionQueryKey } from '../auth/query-options'
import type { MeResponse, ResidentMembership, Session } from '../auth/types'
import { updatePortalResidentPhone } from './api'
import {
  portalPhoneSchema,
  type PortalPhoneFormValues,
} from './schemas'
import { submitHandlingServerErrors } from '../../lib/errors'
import { useMe } from '../auth/hooks'

const residentTypeLabelKey: Record<ResidentMembership['resident_type'], string> = {
  guest_resident: 'portal.residentTypes.guestResident',
  occupant: 'portal.residentTypes.occupant',
  owner: 'portal.residentTypes.owner',
  tenant: 'portal.residentTypes.tenant',
}

export function PortalDashboardPage() {
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

      showNotification({
        color: 'green',
        message: t('portal.phoneSaved'),
        title: t('portal.phoneSavedTitle'),
      })
    },
  })
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
            {t('portal.title')}
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

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-4">
          <h2 className="text-base font-bold text-[var(--mantine-color-text)]">
            {t('portal.householdTitle')}
          </h2>
          <div className="mt-4 grid gap-3">
            {memberships.map((membership) => (
              <div
                className="rounded-md border border-[var(--mantine-color-default-border)] p-3"
                key={membership.unit_membership_id}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--mantine-color-text)]">
                      {membership.unit_label}
                    </p>
                    <p className="text-sm text-[var(--mantine-color-dimmed)]">
                      {t(residentTypeLabelKey[membership.resident_type])}
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
          className="rounded-md border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-4"
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
            <Controller
              control={form.control}
              name="phone"
              render={({ field, fieldState }) => (
                <TextInput
                  {...field}
                  value={field.value ?? ''}
                  error={
                    fieldState.error?.message
                      ? t(fieldState.error.message)
                      : undefined
                  }
                  label={t('portal.phone')}
                />
              )}
            />
            <Button loading={phoneMutation.isPending} type="submit">
              {t('portal.savePhone')}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
