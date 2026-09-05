import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Select, Text, TextInput } from '@mantine/core'
import type { AvailabilityWindow } from '../locations/amenities-api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../app/api-client'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { fieldErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifySuccess } from '../../lib/notify'
import type { AmenitySummary } from '../locations/amenities-api'
import { getResidents } from '../residents/api'
import { getUnits } from '../units/api'
import { createReservation } from './api'
import { reservationFormSchema, type ReservationFormValues } from './schemas'
import { WEEKDAY_KEYS } from './week'

const STEP_MINUTES = 30

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)

  return hours * 60 + minutes
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Every valid 30-minute start inside the day's windows. */
function startOptions(windows: AvailabilityWindow[]): string[] {
  return windows.flatMap((window) => {
    const options: string[] = []
    for (let m = toMinutes(window.start); m + STEP_MINUTES <= toMinutes(window.end); m += STEP_MINUTES) {
      options.push(toTime(m))
    }

    return options
  })
}

/**
 * Ends reachable from the chosen start: inside the same window, at least the
 * minimum duration (rounded up to the grid), at most the maximum.
 */
function endOptions(
  windows: AvailabilityWindow[],
  start: string,
  minDuration: number | null,
  maxDuration: number | null,
): string[] {
  const startMinutes = toMinutes(start)
  const window = windows.find(
    (candidate) => startMinutes >= toMinutes(candidate.start) && startMinutes < toMinutes(candidate.end),
  )

  if (!window) {
    return []
  }

  const minEnd =
    startMinutes + Math.max(STEP_MINUTES, Math.ceil((minDuration ?? 0) / STEP_MINUTES) * STEP_MINUTES)
  const maxEnd = Math.min(
    toMinutes(window.end),
    maxDuration === null ? Number.POSITIVE_INFINITY : startMinutes + maxDuration,
  )

  const options: string[] = []
  for (let m = minEnd; m <= maxEnd; m += STEP_MINUTES) {
    options.push(toTime(m))
  }

  return options
}

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
}: {
  accountId: string
  amenities: AmenitySummary[]
  locationId: string
  onClose: () => void
  opened: boolean
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

  const selected = reservable.find((amenity) => amenity.id === amenityId)
  const weekday = date ? WEEKDAY_KEYS[new Date(`${date}T12:00:00Z`).getUTCDay()] : null
  const windows = selected && weekday ? (selected.availability[weekday] ?? []) : []
  const windowsHint =
    selected && date
      ? windows.length === 0
        ? t('reservations.form.closedThatDay')
        : t('reservations.form.availableWindows', {
            windows: windows.map((window) => `${window.start}–${window.end}`).join(', '),
          })
      : null

  const start = useWatch({ control: form.control, name: 'start' })
  const startTimes = startOptions(windows)
  const endTimes = start
    ? endOptions(windows, start, selected?.min_duration_minutes ?? null, selected?.max_duration_minutes ?? null)
    : []

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
            {windowsHint ? (
              <Text c="dimmed" mt={4} size="xs">
                {windowsHint}
              </Text>
            ) : null}
          </div>
          {/* 30-minute grid, constrained to the day's windows and the
              amenity's duration limits; the API enforces the same rule. */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="start"
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  data={startTimes}
                  disabled={startTimes.length === 0}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('reservations.form.start')}
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
