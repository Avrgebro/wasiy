import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Select, Textarea } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { fieldErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifySuccess } from '../../lib/notify'
import { getResidents } from '../residents/api'
import { useActiveUnitOptions } from '../units/use-active-unit-options'
import { registerPackage } from './api'
import { registerPackageSchema, type RegisterPackageValues } from './schemas'

const EMPTY: RegisterPackageValues = { unit_id: '', resident_id: '', notes: '' }

/**
 * Mockup 14b: unit, optional person, notes. Received-by and time come from the
 * session; the arrival email goes out on registration to the named person or,
 * failing that, the unit's primary contact.
 */
export function RegisterPackageDrawer({
  accountId,
  locationId,
  locationName,
  onClose,
  opened,
}: {
  accountId: string
  locationId: string
  locationName: string
  onClose: () => void
  opened: boolean
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const form = useForm<RegisterPackageValues>({ defaultValues: EMPTY, resolver: zodResolver(registerPackageSchema) })

  useEffect(() => {
    if (opened) {
      form.reset(EMPTY)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened])

  const unitId = useWatch({ control: form.control, name: 'unit_id' })
  const unitOptions = useActiveUnitOptions(opened ? { id: locationId } : null)
  const residentsQuery = useQuery({
    enabled: opened && unitId !== '',
    queryKey: ['residents', 'options', accountId, unitId],
    queryFn: () => getResidents(accountId, { page: 1, per_page: 100, unit_id: unitId }),
  })
  const residentOptions = (residentsQuery.data?.data ?? []).map((resident) => ({ value: resident.id, label: resident.name }))

  const mutation = useMutation({
    mutationFn: (values: RegisterPackageValues) =>
      registerPackage(locationId, { unit_id: values.unit_id, resident_id: values.resident_id || null, notes: values.notes || null }),
    onSuccess: async ({ data }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['packages'] }),
        queryClient.invalidateQueries({ queryKey: ['registry', 'units'] }),
      ])
      onClose()
      notifySuccess(t(data.notified_email ? 'packages.registeredNotified' : 'packages.registeredSilent', { email: data.notified_email ?? '' }))
    },
  })

  return (
    <AppDrawer opened={opened} subtitle={t('packages.subtitle', { location: locationName })} title={t('packages.register')} onClose={onClose}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((values) => submitHandlingServerErrors(form, () => mutation.mutateAsync(values)))}>
        <AppDrawerBody>
          {form.formState.errors.root?.message ? (
            <Alert color="error" title={t('errors.actionFailed')}>
              {form.formState.errors.root.message}
            </Alert>
          ) : null}
          <Controller
            control={form.control}
            name="unit_id"
            render={({ field, fieldState }) => (
              <Select
                {...field}
                data={unitOptions}
                error={fieldErrorMessage(fieldState.error)}
                label={t('packages.form.unit')}
                searchable
                withAsterisk
                onChange={(value) => {
                  field.onChange(value ?? '')
                  form.setValue('resident_id', '')
                }}
              />
            )}
          />
          <Controller
            control={form.control}
            name="resident_id"
            render={({ field, fieldState }) => (
              <Select
                {...field}
                clearable
                data={residentOptions}
                description={t('packages.form.residentHint')}
                disabled={unitId === ''}
                error={fieldErrorMessage(fieldState.error)}
                label={t('packages.form.resident')}
                placeholder={t('packages.form.anyResident')}
                onChange={(value) => field.onChange(value ?? '')}
              />
            )}
          />
          <Controller
            control={form.control}
            name="notes"
            render={({ field, fieldState }) => (
              <Textarea {...field} error={fieldErrorMessage(fieldState.error)} label={t('registry.notes')} placeholder={t('packages.form.notesPlaceholder')} rows={3} />
            )}
          />
        </AppDrawerBody>
        <AppDrawerFooter>
          <Button variant="default" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button color="accent" loading={mutation.isPending} type="submit">
            {t('packages.form.submit')}
          </Button>
        </AppDrawerFooter>
      </form>
    </AppDrawer>
  )
}
