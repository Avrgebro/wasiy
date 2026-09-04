import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, NumberInput, Select, Text, Textarea } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { DrawerSection } from '../../components/ui/detail-drawer-parts'
import { FormTextInput } from '../../components/ui/form-fields'
import { fieldErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifySuccess } from '../../lib/notify'
import { createUnit, updateUnit, type UnitSummary } from './api'
import { toUnitPayload, unitSchema, type UnitFormValues } from './schemas'

const TYPES = ['apartment', 'house', 'commercial', 'office'] as const

function defaults(unit?: UnitSummary | null): UnitFormValues {
  return {
    unit_number: unit?.unit_number ?? '',
    type: unit?.type ?? 'apartment',
    building_name: unit?.building_name ?? '',
    floor: unit?.floor ?? '',
    area_m2: unit?.area_m2 ?? '',
    participation_share: unit?.participation_share ?? '',
    maintenance_fee: unit?.maintenance_fee ?? '',
    parking_spots: unit?.parking_spots.join(', ') ?? '',
    storage_rooms: unit?.storage_rooms.join(', ') ?? '',
    notes: unit?.notes ?? '',
  }
}

/**
 * One component in two modes (mockup 12b): create and edit share the fields;
 * the mode changes the header, the submit label and whether the sensitive
 * zone shows. Deactivation itself is confirmed by the page.
 */
export function UnitFormDrawer({
  editing,
  locationId,
  locationName,
  onClose,
  onDeactivate,
  opened,
}: {
  editing: UnitSummary | null
  locationId: string
  locationName: string
  onClose: () => void
  onDeactivate?: () => void
  opened: boolean
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const form = useForm<UnitFormValues>({ defaultValues: defaults(editing), resolver: zodResolver(unitSchema) })

  useEffect(() => {
    if (opened) {
      form.reset(defaults(editing))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editing?.id])

  const mutation = useMutation({
    mutationFn: (values: UnitFormValues) =>
      editing ? updateUnit(editing.id, toUnitPayload(values)) : createUnit(locationId, toUnitPayload(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['registry', 'units'] })
      onClose()
      notifySuccess(t(editing ? 'units.form.saved' : 'units.form.created'))
    },
  })

  const number = (field: { onChange: (value: number | '') => void }) => (value: string | number) =>
    field.onChange(value === '' ? '' : Number(value))

  return (
    <AppDrawer
      opened={opened}
      subtitle={editing ? [editing.building_name, editing.unit_number].filter(Boolean).join(' · ') : locationName}
      title={t(editing ? 'units.form.editTitle' : 'units.form.createTitle')}
      onClose={onClose}
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((values) => submitHandlingServerErrors(form, () => mutation.mutateAsync(values)))}>
        <AppDrawerBody>
          {form.formState.errors.root?.message ? (
            <Alert color="error" title={t('errors.actionFailed')}>
              {form.formState.errors.root.message}
            </Alert>
          ) : null}

          <DrawerSection label={t('units.form.identity')} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-3.5">
            <FormTextInput control={form.control} label={t('units.form.number')} name="unit_number" />
            <Controller
              control={form.control}
              name="type"
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  allowDeselect={false}
                  data={TYPES.map((value) => ({ value, label: t(`units.types.${value}`) }))}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('units.columns.type')}
                  onChange={(value) => field.onChange(value ?? 'apartment')}
                />
              )}
            />
            <FormTextInput control={form.control} label={t('units.form.building')} name="building_name" />
            <FormTextInput control={form.control} label={t('units.form.floor')} name="floor" />
            <Controller
              control={form.control}
              name="area_m2"
              render={({ field, fieldState }) => (
                <NumberInput
                  {...field}
                  allowNegative={false}
                  decimalScale={2}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('units.form.area')}
                  suffix=" m²"
                  onChange={number(field)}
                />
              )}
            />
          </div>
          <FormTextInput control={form.control} label={t('units.form.parking')} name="parking_spots" placeholder="E-12, E-13" />
          <Text c="dimmed" mt={-16} size="xs">
            {t('units.form.labelsHint')}
          </Text>
          <FormTextInput control={form.control} label={t('units.form.storage')} name="storage_rooms" placeholder="D-04" />
          <Controller
            control={form.control}
            name="notes"
            render={({ field, fieldState }) => (
              <Textarea {...field} error={fieldErrorMessage(fieldState.error)} label={t('registry.notes')} rows={3} />
            )}
          />

          <DrawerSection label={t('units.form.feeSection')} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-3.5">
            <Controller
              control={form.control}
              name="maintenance_fee"
              render={({ field, fieldState }) => (
                <NumberInput
                  {...field}
                  allowDecimal={false}
                  allowNegative={false}
                  description={t('units.form.feeHint')}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('units.detail.monthlyFee')}
                  prefix="S/ "
                  thousandSeparator=" "
                  onChange={number(field)}
                />
              )}
            />
            <Controller
              control={form.control}
              name="participation_share"
              render={({ field, fieldState }) => (
                <NumberInput
                  {...field}
                  allowNegative={false}
                  decimalScale={3}
                  description={t('units.form.shareHint')}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('units.form.share')}
                  suffix=" %"
                  onChange={number(field)}
                />
              )}
            />
          </div>

          {editing && onDeactivate && editing.status === 'active' ? (
            <div className="mt-2 flex flex-col gap-3 rounded-inner border border-[var(--wa-error)]/40 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Text fw={600} size="sm">
                  {t('units.form.sensitiveZone')}
                </Text>
                <Text c="dimmed" size="xs">
                  {t('units.form.sensitiveZoneHint')}
                </Text>
              </div>
              <Button className="w-full sm:w-auto" color="error" variant="light" onClick={onDeactivate}>
                {t('units.form.deactivate')}
              </Button>
            </div>
          ) : null}
        </AppDrawerBody>
        <AppDrawerFooter>
          <Button variant="default" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button color="accent" loading={mutation.isPending} type="submit">
            {t(editing ? 'units.form.save' : 'units.form.create')}
          </Button>
        </AppDrawerFooter>
      </form>
    </AppDrawer>
  )
}
