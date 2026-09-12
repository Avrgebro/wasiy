import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Select, Text } from '@mantine/core'
import { DateField } from '../../components/ui/date-field'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../app/api-client'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { MAX_ADVANCE_DAYS } from '../../lib/calendar'
import { fieldErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifySuccess } from '../../lib/notify'
import { isOpenOn } from '../../lib/open-days'
import { getAmenityAvailability, type AmenitySummary } from '../locations/amenities-api'
import { getResidents } from '../residents/api'
import { getUnits } from '../units/api'
import { formatUnitLabel } from '../units/unit-label'
import { createReservation } from './api'
import { reservationFormSchema, type ReservationFormValues } from './schemas'
import { addDays, localDateString } from './week'

const emptyValues: ReservationFormValues = {
  amenity_id: '',
  unit_id: '',
  resident_id: '',
  date: '',
}

/**
 * The API validator may report on `reserved_on` while the form's field is
 * `date`; remap so the message lands under the picker instead of the root
 * alert.
 */
function remapServerFields(error: unknown): never {
  if (error instanceof ApiError && error.errors) {
    const mapped: Record<string, string[]> = {}
    for (const [key, messages] of Object.entries(error.errors)) {
      mapped[key === 'reserved_on' ? 'date' : key] = messages
    }
    throw new ApiError(error.message, error.status, mapped, error.body)
  }
  throw error
}

/**
 * Nueva reserva (ADR 0043): amenity, unit, resident and a day. Closed
 * weekdays are not selectable; the hint under the date shows the approved
 * count against the capacity, because staff are never blocked by it and
 * decide with the number in view.
 */
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
    // "Torre A / 402" in multi-tower locations; just the number otherwise.
    label: formatUnitLabel(unit),
  }))
  const residentOptions = (residentsQuery.data?.data ?? []).map((resident) => ({
    value: resident.id,
    label: resident.name,
  }))

  const today = localDateString(new Date(), timezone)
  const maxDate = addDays(today, MAX_ADVANCE_DAYS)
  const selectedAmenity = reservable.find((amenity) => amenity.id === amenityId) ?? null

  // One range query per amenity covers the whole horizon the picker offers.
  const availabilityQuery = useQuery({
    enabled: opened && amenityId !== '',
    queryKey: ['reservations', 'availability', amenityId, today, maxDate],
    queryFn: () => getAmenityAvailability(amenityId, today, maxDate),
  })
  const capacity = availabilityQuery.data?.daily_capacity ?? null
  const day = availabilityQuery.data?.days.find((candidate) => candidate.date === date) ?? null
  const capacityHint =
    day && capacity !== null
      ? [
          t('reservations.form.capacityHint', { count: day.approved_count, capacity }),
          day.reason === 'full' ? t('reservations.availability.full') : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null

  const mutation = useMutation({
    mutationFn: (values: ReservationFormValues) =>
      createReservation(accountId, locationId, {
        amenity_id: values.amenity_id,
        unit_id: values.unit_id,
        resident_id: values.resident_id || null,
        date: values.date,
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
                onChange={(value) => {
                  field.onChange(value ?? '')
                  // The open weekdays change with the amenity.
                  form.setValue('date', '')
                }}
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
                  disabled={selectedAmenity === null}
                  error={fieldErrorMessage(fieldState.error)}
                  excludeDate={(candidate) => (selectedAmenity ? !isOpenOn(selectedAmenity.open_days, candidate) : false)}
                  label={t('reservations.form.date')}
                  maxDate={maxDate}
                  minDate={today}
                  placeholder={t('reservations.form.datePlaceholder')}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                />
              )}
            />
            {capacityHint ? (
              <Text c="dimmed" mt={4} size="xs">
                {capacityHint}
              </Text>
            ) : null}
          </div>
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
