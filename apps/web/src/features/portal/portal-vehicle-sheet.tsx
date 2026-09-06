import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { BottomSheet, ConfirmSheet, SheetAction } from '../../components/ui/bottom-sheet'
import { FormTextInput } from '../../components/ui/form-fields'
import { getErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifyError, notifySuccess } from '../../lib/notify'
import { createPortalVehicle, deletePortalVehicle, updatePortalVehicle, type PortalVehicle } from './api'
import { portalVehicleSchema, type PortalVehicleFormValues } from './schemas'

function defaults(vehicle: PortalVehicle | null): PortalVehicleFormValues {
  return { plate: vehicle?.plate ?? '', make: vehicle?.make ?? '', model: vehicle?.model ?? '', color: vehicle?.color ?? '' }
}

/** Vehículo (Portal 04e): one sheet for add and edit; the delete only shows for an existing vehicle. */
export function VehicleSheet({ onClose, opened, unitId, vehicle }: { onClose: () => void; opened: boolean; unitId: string; vehicle: PortalVehicle | null }) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const form = useForm<PortalVehicleFormValues>({ defaultValues: defaults(vehicle), resolver: zodResolver(portalVehicleSchema) })

  useEffect(() => {
    if (opened) form.reset(defaults(vehicle))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, vehicle?.id])

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['portal', 'vehicles', unitId] })
  }

  const save = useMutation({
    mutationFn: (values: PortalVehicleFormValues) => {
      const payload = { plate: values.plate.toUpperCase(), make: values.make || null, model: values.model || null, color: values.color || null }

      return vehicle ? updatePortalVehicle(vehicle.id, payload) : createPortalVehicle(unitId, payload)
    },
    onSuccess: async () => {
      await refresh()
      onClose()
      notifySuccess(t(vehicle ? 'portal.vehicles.saved' : 'portal.vehicles.added'))
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => deletePortalVehicle(id),
    onSuccess: async () => {
      await refresh()
      setConfirming(false)
      onClose()
      notifySuccess(t('portal.vehicles.deleted'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  const rootError = form.formState.errors.root?.message

  return (
    <>
      <BottomSheet
        footer={
          <SheetAction>
            <Button className="w-full" color="accent" form="vehicle-form" loading={save.isPending} type="submit">
              {t('actions.save')}
            </Button>
            {vehicle ? (
              <Button className="w-full" color="error" h={44} variant="subtle" onClick={() => setConfirming(true)}>
                {t('portal.vehicles.delete')}
              </Button>
            ) : null}
          </SheetAction>
        }
        opened={opened}
        title={t(vehicle ? 'portal.vehicles.edit' : 'portal.vehicles.add')}
        withClose
        onClose={onClose}
      >
        <form className="flex flex-col gap-[11px]" id="vehicle-form" onSubmit={form.handleSubmit((values) => submitHandlingServerErrors(form, () => save.mutateAsync(values)))}>
          {rootError ? (
            <Alert color="error" title={t('errors.actionFailed')}>
              {rootError}
            </Alert>
          ) : null}
          <FormTextInput autoComplete="off" control={form.control} label={t('portal.vehicles.plate')} name="plate" placeholder="ABC-123" styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', textTransform: 'uppercase' } }} />
          <FormTextInput autoComplete="off" control={form.control} label={t('portal.vehicles.make')} name="make" placeholder="Toyota" />
          <FormTextInput autoComplete="off" control={form.control} label={t('portal.vehicles.model')} name="model" placeholder="Yaris" />
          <FormTextInput autoComplete="off" control={form.control} label={t('portal.vehicles.color')} name="color" placeholder="Blanco" />
        </form>
      </BottomSheet>

      <ConfirmSheet
        body={t('portal.vehicles.deleteBody')}
        confirmLabel={t('portal.vehicles.delete')}
        opened={confirming}
        pending={remove.isPending}
        title={t('portal.vehicles.deleteTitle', { plate: vehicle?.plate ?? '' })}
        onCancel={() => setConfirming(false)}
        onConfirm={() => vehicle && remove.mutate(vehicle.id)}
      />
    </>
  )
}
