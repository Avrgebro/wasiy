import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, SegmentedControl, Select, Text, Textarea } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { DrawerSection } from '../../components/ui/detail-drawer-parts'
import { FormTextInput } from '../../components/ui/form-fields'
import { fieldErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifySuccess } from '../../lib/notify'
import { getResidents } from '../residents/api'
import { useActiveUnitOptions } from '../units/use-active-unit-options'
import { registerVisit } from './api'
import { registerVisitSchema, VISIT_CONFIRMATIONS, type RegisterVisitValues } from './schemas'

const EMPTY: RegisterVisitValues = { visitor_name: '', document: '', phone: '', unit_id: '', resident_id: '', confirmation: 'none', notes: '' }

/**
 * Mockup 16b. Visitante → Destino → Confirmación → Notas. The unit's primary
 * contact and phone show next to Recibe so the desk can call before confirming
 * without leaving the panel. Check-in time and who registers come from the
 * session.
 */
export function RegisterVisitDrawer({
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
  const form = useForm<RegisterVisitValues>({ defaultValues: EMPTY, resolver: zodResolver(registerVisitSchema) })

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
  const residents = residentsQuery.data?.data ?? []
  const primary = residents.find((resident) => resident.memberships.some((m) => m.unit_id === unitId && m.status === 'active' && m.is_primary_contact))

  const mutation = useMutation({
    mutationFn: (values: RegisterVisitValues) =>
      registerVisit(locationId, {
        visitor_name: values.visitor_name,
        unit_id: values.unit_id,
        resident_id: values.resident_id || null,
        document: values.document || null,
        phone: values.phone || null,
        confirmation: values.confirmation,
        notes: values.notes || null,
      }),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['visits'] }), queryClient.invalidateQueries({ queryKey: ['registry', 'units'] })])
      onClose()
      notifySuccess(t('visits.registered'))
    },
  })

  return (
    <AppDrawer opened={opened} subtitle={t('visits.subtitleShort', { location: locationName })} title={t('visits.register')} onClose={onClose}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((values) => submitHandlingServerErrors(form, () => mutation.mutateAsync(values)))}>
        <AppDrawerBody>
          {form.formState.errors.root?.message ? (
            <Alert color="error" title={t('errors.actionFailed')}>
              {form.formState.errors.root.message}
            </Alert>
          ) : null}
          <DrawerSection label={t('visits.form.visitor')} />
          <FormTextInput autoComplete="off" control={form.control} label={t('visits.form.name')} name="visitor_name" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-3.5">
            <Controller
              control={form.control}
              name="document"
              render={() => (
                <FormTextInput control={form.control} label={t('visits.form.document')} name="document" placeholder="DNI 45872213" />
              )}
            />
            <FormTextInput control={form.control} label={t('visits.form.phone')} name="phone" placeholder="+51 9…" />
          </div>
          <Text c="dimmed" mt={-12} size="xs">
            {t('visits.form.documentHint')}
          </Text>

          <DrawerSection description={t('visits.form.destinationHint')} label={t('visits.form.destination')} />
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
                data={residents.map((resident) => ({ value: resident.id, label: resident.name }))}
                disabled={unitId === ''}
                error={fieldErrorMessage(fieldState.error)}
                label={t('visits.form.host')}
                onChange={(value) => field.onChange(value ?? '')}
              />
            )}
          />
          {primary ? (
            <Text c="dimmed" mt={-12} size="xs">
              {t('visits.form.primaryContact')}: {primary.name}
              {primary.phone ? (
                <>
                  {' · '}
                  <a className="text-[var(--wa-interactive)] no-underline hover:underline" href={`tel:${primary.phone.replace(/\s+/g, '')}`}>
                    {primary.phone}
                  </a>
                </>
              ) : null}
            </Text>
          ) : null}

          <DrawerSection label={t('visits.form.confirmation')} />
          <Controller
            control={form.control}
            name="confirmation"
            render={({ field }) => (
              <SegmentedControl {...field} data={VISIT_CONFIRMATIONS.map((value) => ({ value, label: t(`visits.confirmations.${value}`) }))} fullWidth />
            )}
          />
          <Text c="dimmed" mt={-12} size="xs">
            {t('visits.form.confirmationHint')}
          </Text>

          <Controller
            control={form.control}
            name="notes"
            render={({ field, fieldState }) => <Textarea {...field} error={fieldErrorMessage(fieldState.error)} label={t('registry.notes')} rows={3} />}
          />
        </AppDrawerBody>
        <AppDrawerFooter>
          <Button variant="default" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button color="accent" loading={mutation.isPending} type="submit">
            {t('visits.form.submit')}
          </Button>
        </AppDrawerFooter>
      </form>
    </AppDrawer>
  )
}
