import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Select, Text } from '@mantine/core'
import { DateField } from '../../components/ui/date-field'
import { SlotGrid } from '../../components/ui/slot-grid'
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
import { closedWeekday, MAX_ADVANCE_DAYS } from './reservation-slots'
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
  const selectedAmenity = reservable.find((amenity) => amenity.id === amenityId) ?? null
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
                <DateField
                  error={fieldErrorMessage(fieldState.error)}
                  // Closed weekdays are not selectable, so the "cerrado" hint
                  // only ever shows for a date typed by the API's own rules.
                  excludeDate={(candidate) => (selectedAmenity ? closedWeekday(selectedAmenity.availability, candidate) : false)}
                  label={t('reservations.form.date')}
                  maxDate={maxDate}
                  minDate={today}
                  placeholder={t('reservations.form.datePlaceholder')}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(value) => {
                    field.onChange(value)
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
          {/* One slot per booking (ADR 0041): the same grid the portal uses;
              picking a slot fixes the end. */}
          {slots.length > 0 ? (
            <Controller
              control={form.control}
              name="start"
              render={({ field, fieldState }) => (
                <SlotGrid
                  error={fieldErrorMessage(fieldState.error) ?? fieldErrorMessage(form.formState.errors.end)}
                  label={t('reservations.form.startSlot')}
                  slots={slots}
                  value={field.value}
                  onChange={(start) => {
                    field.onChange(start)
                    form.setValue('end', slots.find((slot) => slot.start === start)?.end ?? '')
                  }}
                />
              )}
            />
          ) : amenityId === '' || date === '' ? (
            <Text c="dimmed" size="sm">
              {t('reservations.form.pickAmenityAndDay')}
            </Text>
          ) : null}
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
