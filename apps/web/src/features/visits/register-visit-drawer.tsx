import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Badge, Button, SegmentedControl, Select, Text, Textarea } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMe, usePhoneFormat } from '../auth/hooks'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { DrawerField, DrawerRow, DrawerSection } from '../../components/ui/detail-drawer-parts'
import { FormTextInput } from '../../components/ui/form-fields'
import { FormPhoneInput } from '../../components/ui/phone-input'
import { fieldErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifySuccess } from '../../lib/notify'
import { telHref } from '../../lib/phone'
import { getResidents } from '../residents/api'
import { useActiveUnitOptions } from '../units/use-active-unit-options'
import { confirmArrival, getVisits, registerVisit, type VisitSummary } from './api'
import { registerVisitSchema, VISIT_CONFIRMATIONS, type RegisterVisitValues } from './schemas'

const EMPTY: RegisterVisitValues = { visitor_name: '', document: '', phone: '', unit_id: '', resident_id: '', confirmation: 'none', notes: '' }

/**
 * Mockup 16c. Destino → Esperados hoy → Visitante → Confirmación → Notas. The
 * unit comes first because the band under it lists what the resident
 * pre-registered for today; confirming one fills the visitor and fixes the
 * confirmation to "Pre-registrado". Walk-ins keep the 16b flow with the four
 * methods. Check-in time and who registers come from the session.
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
  const country = useMe().data?.active_location?.country ?? 'PE'
  const formatPhone = usePhoneFormat()
  const form = useForm<RegisterVisitValues>({ defaultValues: EMPTY, resolver: zodResolver(registerVisitSchema) })
  // The pre-registration being confirmed, if the desk picked one from the band.
  const [expected, setExpected] = useState<VisitSummary | null>(null)

  function close() {
    setExpected(null)
    onClose()
  }

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
  const expectedQuery = useQuery({
    enabled: opened && unitId !== '',
    queryKey: ['visits', locationId, 'expected', unitId],
    queryFn: () => getVisits(locationId, { expected: 1, unit_id: unitId, per_page: 20 }),
  })
  const expectedToday = expectedQuery.data?.data ?? []

  function pickExpected(visit: VisitSummary) {
    setExpected(visit)
    form.setValue('visitor_name', visit.visitor_name)
    form.setValue('document', visit.document ?? '')
    form.setValue('resident_id', visit.resident_id ?? '')
    form.setValue('notes', visit.notes ?? '')
  }

  const primary = residents.find((resident) => resident.memberships.some((m) => m.unit_id === unitId && m.status === 'active' && m.is_primary_contact))

  const mutation = useMutation({
    mutationFn: (values: RegisterVisitValues) =>
      expected
        ? confirmArrival(expected.id, { visitor_name: values.visitor_name, document: values.document || null, phone: values.phone || null, notes: values.notes || null })
        : registerVisit(locationId, {
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
      close()
      notifySuccess(t('visits.registered'))
    },
  })

  return (
    <AppDrawer opened={opened} subtitle={t('visits.subtitleShort', { location: locationName })} title={t('visits.register')} onClose={close}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((values) => submitHandlingServerErrors(form, () => mutation.mutateAsync(values)))}>
        <AppDrawerBody>
          {form.formState.errors.root?.message ? (
            <Alert color="error" title={t('errors.actionFailed')}>
              {form.formState.errors.root.message}
            </Alert>
          ) : null}
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
                  setExpected(null)
                }}
              />
            )}
          />
          <DrawerField
            note={
              primary ? (
                <>
                  {t('visits.form.primaryContact')}: {primary.name}
                  {primary.phone ? (
                    <>
                      {' · '}
                      <a className="text-[var(--wa-interactive)] no-underline hover:underline" href={telHref(primary.phone)}>
                        {formatPhone(primary.phone)}
                      </a>
                    </>
                  ) : null}
                </>
              ) : undefined
            }
          >
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
          </DrawerField>

          <DrawerSection description={t('visits.expected.bandHint')} label={t('visits.expected.band')} />
          {unitId === '' ? (
            <Text c="dimmed" size="sm">
              {t('visits.expected.pickUnit')}
            </Text>
          ) : expectedToday.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('visits.expected.none')}
            </Text>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {expectedToday.map((visit) => (
                <li key={visit.id} className="flex items-center gap-3 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-3.5 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{visit.visitor_name}</span>
                    <span className="truncate text-xs text-[var(--mantine-color-dimmed)]">
                      {visit.expected_time ?? t('visits.expected.noTime')}
                      {visit.pre_registered_by_name ? ` · ${t('visits.expected.by', { name: visit.pre_registered_by_name })}` : ''}
                    </span>
                  </span>
                  {expected?.id === visit.id ? (
                    <Badge color="info" radius="xl" size="sm" variant="light">
                      {t('visits.expected.chosen')}
                    </Badge>
                  ) : (
                    <Button size="compact-sm" variant="default" onClick={() => pickExpected(visit)}>
                      {t('visits.expected.confirm')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <DrawerSection label={t('visits.form.visitor')} />
          <FormTextInput autoComplete="off" control={form.control} label={t('visits.form.name')} name="visitor_name" />
          <DrawerField note={t('visits.form.documentHint')}>
            <DrawerRow>
              <FormTextInput control={form.control} label={t('visits.form.document')} name="document" placeholder="DNI 45872213" />
              <FormPhoneInput control={form.control} defaultCountry={country} label={t('visits.form.phone')} name="phone" placeholder="987 654 321" />
            </DrawerRow>
          </DrawerField>

          <DrawerSection label={t('visits.form.confirmation')} />
          {expected ? (
            <DrawerField note={t('visits.expected.confirmationLocked')}>
              <div>
                <Badge color="info" radius="xl" size="md" variant="light">
                  {t('visits.confirmations.pre_registered')}
                </Badge>
              </div>
            </DrawerField>
          ) : (
            <DrawerField note={t('visits.form.confirmationHint')}>
              <Controller
                control={form.control}
                name="confirmation"
                render={({ field }) => (
                  <SegmentedControl {...field} data={VISIT_CONFIRMATIONS.map((value) => ({ value, label: t(`visits.confirmations.${value}`) }))} fullWidth size="md"/>
                )}
              />
            </DrawerField>
          )}

          <Controller
            control={form.control}
            name="notes"
            render={({ field, fieldState }) => <Textarea {...field} error={fieldErrorMessage(fieldState.error)} label={t('registry.notes')} rows={3} />}
          />
        </AppDrawerBody>
        <AppDrawerFooter>
          <Button variant="default" onClick={close}>
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
