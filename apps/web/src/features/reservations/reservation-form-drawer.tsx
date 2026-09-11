import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Select, Text, TextInput } from '@mantine/core'
import { DrawerRow } from '../../components/ui/detail-drawer-parts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../app/api-client'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { fieldErrorMessage, getErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifySuccess } from '../../lib/notify'
import { getAmenityAvailability, type AmenitySummary } from '../locations/amenities-api'
import { getResidents } from '../residents/api'
import { getUnits } from '../units/api'
import { createReservation } from './api'
import { reservationFormSchema, type ReservationFormValues } from './schemas'
import { endOptionsFrom, MAX_ADVANCE_DAYS } from './reservation-slots'
import { addDays, localDateString } from './week'

const emptyValues: ReservationFormValues = {
  amenity_id: '',
  unit_id: '',
  resident_id: '',
  date: '',
  start: '',
  end: '',
}

/**
 * The API validator reports on starts_at/ends_at while the form's fields
 * are date/start/end; remap so server messages land under the inputs
 * instead of the root alert.
 */
function remapServerFields(error: unknown): never {
  if (error instanceof ApiError && error.errors) {
    const mapped: Record<string, string[]> = {}
    for (const [key, messages] of Object.entries(error.errors)) {
      mapped[key === 'starts_at' ? 'start' : key === 'ends_at' ? 'end' : key] = messages
    }
    throw new ApiError(error.message, error.status, mapped, error.body)
  }
  throw error
}

export function ReservationFormDrawer({
  accountId,
  amenities,
  locationId,
  onClose,
  opened,
  timezone,
}: {
  accountId: string
  amenities: AmenitySummary[]
  locationId: string
  onClose: () => void
  opened: boolean
  timezone: string
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const form = useForm<ReservationFormValues>({
    defaultValues: emptyValues,
    resolver: zodResolver(reservationFormSchema),
  })

  useEffect(() => {
    if (opened) {
      form.reset(emptyValues)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened])

  const amenityId = useWatch({ control: form.control, name: 'amenity_id' })
  const unitId = useWatch({ control: form.control, name: 'unit_id' })
  const date = useWatch({ control: form.control, name: 'date' })

  const unitsQuery = useQuery({
    enabled: opened,
    queryKey: ['units', 'options', locationId],
    queryFn: () => getUnits(locationId, { page: 1, per_page: 100, status: 'active' }),
  })
  const residentsQuery = useQuery({
    enabled: opened && unitId !== '',
    queryKey: ['residents', 'options', accountId, unitId],
    queryFn: () => getResidents(accountId, { page: 1, per_page: 100, unit_id: unitId }),
  })

  const reservable = amenities.filter(
    (amenity) => amenity.is_reservable && amenity.status === 'active',
  )
  const amenityOptions = reservable.map((amenity) => ({ value: amenity.id, label: amenity.name }))
  const unitOptions = (unitsQuery.data?.data ?? []).map((unit) => ({
    value: unit.id,
    label: unit.unit_number,
  }))
  const residentOptions = (residentsQuery.data?.data ?? []).map((resident) => ({
    value: resident.id,
    label: resident.name,
  }))

  const today = localDateString(new Date(), timezone)
  const maxDate = addDays(today, MAX_ADVANCE_DAYS)
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today && date <= maxDate

  // The server is the only place slots are computed (ADR 0041); the drawer
  // shows what it offers and posts one of those runs back.
  const availabilityQuery = useQuery({
    enabled: opened && amenityId !== '' && dateValid,
    queryKey: ['reservations', 'availability', amenityId, date, unitId],
    queryFn: () => getAmenityAvailability(amenityId, date, unitId || undefined),
  })
  const slots = availabilityQuery.data?.slots ?? []
  const freeSlots = slots.filter((slot) => slot.available)
  const slotsHint =
    amenityId && date
      ? !dateValid
        ? t('reservations.form.dateOutOfRange', { days: MAX_ADVANCE_DAYS })
        : availabilityQuery.isLoading
          ? null
          : availabilityQuery.isError
            ? getErrorMessage(availabilityQuery.error)
            : slots.length === 0
              ? t('reservations.form.closedThatDay')
              : freeSlots.length === 0
                ? t('reservations.form.fullyBooked')
                : null
      : null

  const start = useWatch({ control: form.control, name: 'start' })
  const startTimes = freeSlots.map((slot) => ({ value: slot.start, label: `${slot.start}–${slot.end}` }))
  const endTimes = start ? endOptionsFrom(slots, start) : []

  const mutation = useMutation({
    mutationFn: (values: ReservationFormValues) =>
      createReservation(accountId, locationId, {
        amenity_id: values.amenity_id,
        unit_id: values.unit_id,
        resident_id: values.resident_id || null,
        date: values.date,
        start: values.start,
        end: values.end,
      }).catch(remapServerFields),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['reservations'] })
      onClose()
      notifySuccess(
        response.data.status === 'approved'
          ? t('reservations.toasts.created')
          : t('reservations.toasts.requested'),
      )
    },
  })

  async function handleSubmit(values: ReservationFormValues) {
    await submitHandlingServerErrors(form, () => mutation.mutateAsync(values))
  }

  return (
    <AppDrawer opened={opened} title={t('reservations.newReservation')} onClose={onClose}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit(handleSubmit)}>
        <AppDrawerBody>
          {form.formState.errors.root?.message ? (
            <Alert color="error" title={t('errors.actionFailed')}>
              {form.formState.errors.root.message}
            </Alert>
          ) : null}
          <Controller
            control={form.control}
            name="amenity_id"
            render={({ field, fieldState }) => (
              <Select
                {...field}
                data={amenityOptions}
                error={fieldErrorMessage(fieldState.error)}
                label={t('reservations.form.amenity')}
                searchable
              />
            )}
          />
          <Controller
            control={form.control}
            name="unit_id"
            render={({ field, fieldState }) => (
              <Select
                {...field}
                data={unitOptions}
                error={fieldErrorMessage(fieldState.error)}
                label={t('reservations.form.unit')}
                searchable
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
                disabled={unitId === ''}
                error={fieldErrorMessage(fieldState.error)}
                label={t('reservations.form.resident')}
                onChange={(value) => field.onChange(value ?? '')}
              />
            )}
          />
          <div>
            <Controller
              control={form.control}
              name="date"
              render={({ field, fieldState }) => (
                <TextInput
                  {...field}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('reservations.form.date')}
                  max={maxDate}
                  min={today}
                  type="date"
                  onChange={(event) => {
                    field.onChange(event)
                    // The weekday's windows change with the date.
                    form.setValue('start', '')
                    form.setValue('end', '')
                  }}
                />
              )}
            />
            {slotsHint ? (
              <Text c="dimmed" mt={4} size="xs">
                {slotsHint}
              </Text>
            ) : null}
          </div>
          {/* Start = a free slot the server offered; end = the end of that
              slot or of any consecutive free slot after it. */}
          <DrawerRow>
            <Controller
              control={form.control}
              name="start"
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  data={startTimes}
                  disabled={startTimes.length === 0}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('reservations.form.startSlot')}
                  placeholder={startTimes.length === 0 ? '—' : undefined}
                  searchable
                  onChange={(value) => {
                    field.onChange(value ?? '')
                    form.setValue('end', '')
                  }}
                />
              )}
            />
            <Controller
              control={form.control}
              name="end"
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  data={endTimes}
                  disabled={endTimes.length === 0}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('reservations.form.end')}
                  placeholder={endTimes.length === 0 ? '—' : undefined}
                  searchable
                  onChange={(value) => field.onChange(value ?? '')}
                />
              )}
            />
          </DrawerRow>
        </AppDrawerBody>
        <AppDrawerFooter>
          <Button variant="default" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button color="accent" loading={mutation.isPending} type="submit">
            {t('reservations.form.submit')}
          </Button>
        </AppDrawerFooter>
      </form>
    </AppDrawer>
  )
}
