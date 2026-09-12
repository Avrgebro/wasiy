import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Select, Textarea } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { ConfirmDialog, DangerZone, DrawerRow } from '../../components/ui/detail-drawer-parts'
import { FormTextInput } from '../../components/ui/form-fields'
import { fieldErrorMessage, getErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifyError, notifySuccess } from '../../lib/notify'
import { createVehicle, updateVehicle, type VehicleSummary } from '../vehicles/api'
import { vehicleFormSchema, VEHICLE_TYPES, type VehicleFormValues } from './schemas'

function defaults(vehicle?: VehicleSummary | null): VehicleFormValues {
  return {
    plate: vehicle?.plate ?? '',
    vehicle_type: vehicle?.vehicle_type ?? 'car',
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    color: vehicle?.color ?? '',
    notes: vehicle?.notes ?? '',
  }
}

/** Mockup 12d: vehicles live inside the unit; there is no module of their own. */
export function VehicleDrawer({
  editing,
  locationId,
  onClose,
  opened,
  unitId,
  unitNumber,
}: {
  editing: VehicleSummary | null
  locationId: string
  onClose: () => void
  opened: boolean
  unitId: string
  unitNumber: string
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const form = useForm<VehicleFormValues>({ defaultValues: defaults(editing), resolver: zodResolver(vehicleFormSchema) })

  useEffect(() => {
    if (opened) {
      form.reset(defaults(editing))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editing?.id])

  const payload = (values: VehicleFormValues) => ({
    plate: values.plate.toUpperCase() || null,
    vehicle_type: values.vehicle_type,
    make: values.make || null,
    model: values.model || null,
    color: values.color || null,
    notes: values.notes || null,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['registry', 'units'] })

  const mutation = useMutation({
    mutationFn: (values: VehicleFormValues) =>
      editing
        ? updateVehicle(editing.id, { ...payload(values), status: editing.status, unit_id: unitId })
        : createVehicle(locationId, { ...payload(values), status: 'active', unit_id: unitId }),
    onSuccess: async () => {
      await invalidate()
      onClose()
      notifySuccess(t(editing ? 'units.vehicle.saved' : 'units.vehicle.added'))
    },
  })

  const toggleStatus = useMutation({
    mutationFn: () =>
      updateVehicle(editing!.id, { status: editing!.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: async () => {
      await invalidate()
      setConfirming(false)
      onClose()
      notifySuccess(t(editing?.status === 'active' ? 'units.vehicle.deactivated' : 'units.vehicle.reactivated'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  return (
    <AppDrawer opened={opened} subtitle={unitNumber} title={t('units.vehicle.title')} onClose={onClose}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((values) => submitHandlingServerErrors(form, () => mutation.mutateAsync(values)))}>
        <AppDrawerBody>
          {form.formState.errors.root?.message ? (
            <Alert color="error" title={t('errors.actionFailed')}>
              {form.formState.errors.root.message}
            </Alert>
          ) : null}
          <DrawerRow>
            <FormTextInput control={form.control} label={t('registry.vehicles.plate')} name="plate" placeholder="AXB-241" styles={{ input: { fontFamily: 'var(--font-mono, ui-monospace, monospace)', textTransform: 'uppercase' } }} />
            <Controller
              control={form.control}
              name="vehicle_type"
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  allowDeselect={false}
                  data={VEHICLE_TYPES.map((value) => ({ value, label: t(`registry.vehicleTypes.${value}`) }))}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('registry.vehicles.type')}
                  onChange={(value) => field.onChange(value ?? 'car')}
                />
              )}
            />
            <FormTextInput control={form.control} label={t('registry.vehicles.make')} name="make" />
            <FormTextInput control={form.control} label={t('registry.vehicles.model')} name="model" />
            <FormTextInput control={form.control} label={t('registry.vehicles.color')} name="color" />
          </DrawerRow>
          <Controller
            control={form.control}
            name="notes"
            render={({ field, fieldState }) => (
              <Textarea {...field} error={fieldErrorMessage(fieldState.error)} label={t('registry.notes')} />
            )}
          />
          {editing ? (
            <DangerZone action={<Button className="w-full" color={editing.status === 'active' ? 'error' : undefined} variant={editing.status === 'active' ? 'light' : 'default'} onClick={() => (editing.status === 'active' ? setConfirming(true) : toggleStatus.mutate())} > {t(editing.status === 'active' ? 'units.vehicle.deactivate' : 'units.vehicle.reactivate')} </Button>} description={t('units.vehicle.deactivateHint')} title={t('units.form.sensitiveZone')} />
          ) : null}
          <ConfirmDialog
            body={t('units.vehicle.confirmDeactivateBody')}
            opened={confirming}
            title={t('units.vehicle.confirmDeactivate', { plate: editing?.plate ?? '' })}
            onCancel={() => setConfirming(false)}
            onConfirm={() => toggleStatus.mutate()}
          />
        </AppDrawerBody>
        <AppDrawerFooter>
          <Button variant="default" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button color="accent" loading={mutation.isPending} type="submit">
            {t('actions.save')}
          </Button>
        </AppDrawerFooter>
      </form>
    </AppDrawer>
  )
}
