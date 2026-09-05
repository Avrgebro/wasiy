import { Alert, Button, NumberInput, Select, Switch, Text, Textarea, TextInput } from '@mantine/core'
import { notifySuccess } from '../../lib/notify'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { DrawerSection } from '../../components/ui/detail-drawer-parts'
import { ApiError } from '../../app/api-client'
import { getErrorMessage } from '../../lib/errors'
import { getLocationSettings } from './api'
import {
  createAmenity,
  updateAmenity,
  type AmenityPayload,
  type AmenitySummary,
  type AmenityTypeValue,
  type Availability,
} from './amenities-api'
import { AmenityAvailabilityEditor } from './amenity-availability-editor'
import { availabilityHasConflicts, WEEKDAYS } from './amenity-schedule'

const AMENITY_TYPES: AmenityTypeValue[] = [
  'pool',
  'gym',
  'event_room',
  'meeting_room',
  'court',
  'rooftop',
  'other',
]

const INPUT_WRAPPER_ORDER: ('label' | 'input' | 'description' | 'error')[] = [
  'label',
  'input',
  'description',
  'error',
]

type FormState = {
  name: string
  type: AmenityTypeValue
  description: string
  capacity: number | ''
  is_reservable: boolean
  requires_approval: boolean
  availability: Availability
  max_advance_days: number | ''
  max_concurrent_per_unit: number | ''
  cancellation_window_hours: number | ''
  max_duration_hours: number | ''
  fee_amount: number | ''
  deposit_amount: number | ''
}

function amenityDefaults(amenity?: AmenitySummary | null): FormState {
  return {
    name: amenity?.name ?? '',
    type: amenity?.type ?? 'other',
    description: amenity?.description ?? '',
    capacity: amenity?.capacity ?? '',
    is_reservable: amenity?.is_reservable ?? true,
    requires_approval: amenity?.booking_mode === 'approval',
    availability: amenity?.availability ?? {},
    max_advance_days: amenity?.max_advance_days ?? '',
    max_concurrent_per_unit: amenity?.max_concurrent_per_unit ?? '',
    cancellation_window_hours: amenity?.cancellation_window_hours ?? '',
    max_duration_hours: amenity?.max_duration_minutes ? amenity.max_duration_minutes / 60 : '',
    fee_amount: amenity?.fee_amount ?? '',
    deposit_amount: amenity?.deposit_amount ?? '',
  }
}

function toPayload(form: FormState): AmenityPayload {
  const availability = Object.fromEntries(
    WEEKDAYS.map((day) => [
      day,
      (form.availability[day] ?? []).filter((window) => window.start && window.end),
    ]).filter(([, windows]) => (windows as unknown[]).length > 0),
  )

  return {
    name: form.name.trim(),
    type: form.type,
    description: form.description.trim() === '' ? null : form.description.trim(),
    capacity: form.capacity === '' ? null : form.capacity,
    is_reservable: form.is_reservable,
    booking_mode: form.requires_approval ? 'approval' : 'instant',
    availability,
    // Empty policy fields submit null — inherit from the location — never
    // the placeholder value the input displays.
    max_advance_days: form.max_advance_days === '' ? null : form.max_advance_days,
    max_concurrent_per_unit: form.max_concurrent_per_unit === '' ? null : form.max_concurrent_per_unit,
    cancellation_window_hours:
      form.cancellation_window_hours === '' ? null : form.cancellation_window_hours,
    max_duration_minutes: form.max_duration_hours === '' ? null : form.max_duration_hours * 60,
    fee_amount: form.fee_amount === '' ? null : form.fee_amount,
    deposit_amount: form.deposit_amount === '' ? null : form.deposit_amount,
  }
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="pt-1">
      <DrawerSection label={children} />
    </div>
  )
}

/**
 * The 06c drawer: básicos, disponibilidad, política de reserva, cuotas.
 * Booking policy fields show the inherited location value as helper text —
 * "Vacío = heredar de la ubicación (30 días)" — so inheritance is visible
 * rather than implied. Photos are managed from the edit flow once the
 * amenity exists.
 */
export function AmenityFormDrawer({
  accountId,
  editing,
  locationId,
  onClose,
  opened,
  timezone,
}: {
  accountId: string
  editing: AmenitySummary | null
  locationId: string
  onClose: () => void
  opened: boolean
  timezone: string
}) {
  const { t } = useTranslation('common')

  return (
    <AppDrawer
      opened={opened}
      subtitle={editing ? editing.name : t('amenities.createSubtitle')}
      title={editing ? t('amenities.editTitle') : t('amenities.createTitle')}
      onClose={onClose}
    >
      {/* The Drawer itself stays mounted so its slide transition plays;
          only the form remounts per open, giving fresh state without a
          reset effect. */}
      <AmenityForm
        key={`${editing?.id ?? 'new'}-${opened}`}
        accountId={accountId}
        editing={editing}
        locationId={locationId}
        opened={opened}
        timezone={timezone}
        onClose={onClose}
      />
    </AppDrawer>
  )
}

function AmenityForm({
  accountId,
  editing,
  locationId,
  onClose,
  opened,
  timezone,
}: {
  accountId: string
  editing: AmenitySummary | null
  locationId: string
  onClose: () => void
  opened: boolean
  timezone: string
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(amenityDefaults(editing))
  const [serverError, setServerError] = useState<string | null>(null)

  // The location's resolved reservation defaults feed the inheritance
  // helper text under each empty policy field.
  const settingsQuery = useQuery({
    enabled: opened,
    queryKey: ['locations', 'settings', accountId, locationId],
    queryFn: () => getLocationSettings(accountId, locationId),
  })
  const locationDefaults = settingsQuery.data?.data.values

  const mutation = useMutation({
    mutationFn: (payload: AmenityPayload) =>
      editing
        ? updateAmenity(accountId, locationId, editing.id, payload)
        : createAmenity(accountId, locationId, payload),
    onSuccess: async () => {
      onClose()
      await queryClient.invalidateQueries({ queryKey: ['locations'] })
      notifySuccess(editing ? t('amenities.updated') : t('amenities.created'))
    },
    onError: (error) => {
      setServerError(
        error instanceof ApiError && error.errors
          ? Object.values(error.errors).flat().join(' ')
          : getErrorMessage(error),
      )
    },
  })

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const conflicts = availabilityHasConflicts(form.availability)
  const nameMissing = form.name.trim() === ''

  function inheritHint(field: 'max_advance_days' | 'max_concurrent_per_unit' | 'cancellation_window_hours', unitKey: string) {
    if (!locationDefaults) {
      return undefined
    }

    const inherited = {
      max_advance_days: locationDefaults.reservation_max_advance_days,
      max_concurrent_per_unit: locationDefaults.reservation_max_concurrent_per_unit,
      cancellation_window_hours: locationDefaults.reservation_cancellation_window_hours,
    }[field]
    const unit = t(unitKey)

    return form[field] === ''
      ? t('amenities.policy.inheritHint', { value: inherited, unit })
      : t('amenities.policy.overrideHint', { value: inherited, unit })
  }

  const typeOptions = AMENITY_TYPES.map((value) => ({
    label: t(`amenities.types.${value}`),
    value,
  }))

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()

        if (!conflicts && !nameMissing) {
          mutation.mutate(toPayload(form))
        }
      }}
    >
      <AppDrawerBody>
        <div className="flex flex-col gap-3">
          {serverError ? <Alert color="error">{serverError}</Alert> : null}

          <SectionLabel>{t('amenities.sections.basics')}</SectionLabel>
          <TextInput
            label={t('amenities.form.name')}
            placeholder={t('amenities.form.namePlaceholder')}
            required
            value={form.name}
            onChange={(event) => set('name', event.currentTarget.value)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              allowDeselect={false}
              data={typeOptions}
              label={t('amenities.form.type')}
              value={form.type}
              onChange={(value) => value && set('type', value as AmenityTypeValue)}
            />
            <NumberInput
              allowNegative={false}
              label={t('amenities.form.capacity')}
              min={1}
              placeholder="—"
              suffix={` ${t('amenities.form.people')}`}
              value={form.capacity}
              onChange={(value) => set('capacity', typeof value === 'number' ? value : '')}
            />
          </div>
          <Textarea
            label={t('amenities.form.description')}
            rows={2}
            value={form.description}
            onChange={(event) => set('description', event.currentTarget.value)}
          />
          <Switch
            checked={form.is_reservable}
            description={t('amenities.form.reservableHint')}
            label={t('amenities.form.reservable')}
            onChange={(event) => set('is_reservable', event.currentTarget.checked)}
          />

          <SectionLabel>{t('amenities.sections.availability')}</SectionLabel>
          <AmenityAvailabilityEditor
            readOnly={false}
            timezone={timezone}
            value={form.availability}
            onChange={(availability) => set('availability', availability)}
          />

          {form.is_reservable ? (
            <>
              <SectionLabel>{t('amenities.sections.policy')}</SectionLabel>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:[&_.mantine-InputWrapper-label]:min-h-[2.5rem] sm:[&_.mantine-InputWrapper-label]:flex sm:[&_.mantine-InputWrapper-label]:items-end">
                <NumberInput
                  allowNegative={false}
                  description={inheritHint('max_advance_days', 'settings.reservations.days')}
                  inputWrapperOrder={INPUT_WRAPPER_ORDER}
                  label={t('settings.reservations.maxAdvance')}
                  min={1}
                  placeholder={String(locationDefaults?.reservation_max_advance_days ?? '')}
                  value={form.max_advance_days}
                  onChange={(value) => set('max_advance_days', typeof value === 'number' ? value : '')}
                />
                <NumberInput
                  allowNegative={false}
                  description={inheritHint('max_concurrent_per_unit', 'settings.reservations.reservations')}
                  inputWrapperOrder={INPUT_WRAPPER_ORDER}
                  label={t('settings.reservations.maxConcurrent')}
                  min={1}
                  placeholder={String(locationDefaults?.reservation_max_concurrent_per_unit ?? '')}
                  value={form.max_concurrent_per_unit}
                  onChange={(value) =>
                    set('max_concurrent_per_unit', typeof value === 'number' ? value : '')
                  }
                />
                <NumberInput
                  allowNegative={false}
                  description={inheritHint('cancellation_window_hours', 'settings.reservations.hours')}
                  inputWrapperOrder={INPUT_WRAPPER_ORDER}
                  label={t('settings.reservations.cancellationWindow')}
                  min={1}
                  placeholder={String(locationDefaults?.reservation_cancellation_window_hours ?? '')}
                  value={form.cancellation_window_hours}
                  onChange={(value) =>
                    set('cancellation_window_hours', typeof value === 'number' ? value : '')
                  }
                />
                <NumberInput
                  allowNegative={false}
                  description={
                    form.max_duration_hours === ''
                      ? t('amenities.form.maxDurationHint')
                      : undefined
                  }
                  inputWrapperOrder={INPUT_WRAPPER_ORDER}
                  label={t('amenities.form.maxDuration')}
                  min={1}
                  placeholder="—"
                  suffix={` ${t('settings.reservations.hours')}`}
                  value={form.max_duration_hours}
                  onChange={(value) => set('max_duration_hours', typeof value === 'number' ? value : '')}
                />
              </div>
              <Switch
                checked={form.requires_approval}
                description={t('amenities.form.approvalHint')}
                label={t('amenities.form.requiresApproval')}
                onChange={(event) => set('requires_approval', event.currentTarget.checked)}
              />

              <SectionLabel>{t('amenities.sections.fees')}</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <NumberInput
                  allowDecimal={false}
                  allowNegative={false}
                  label={t('amenities.form.fee')}
                  placeholder="0"
                  prefix="S/ "
                  value={form.fee_amount}
                  onChange={(value) => set('fee_amount', typeof value === 'number' ? value : '')}
                />
                <NumberInput
                  allowDecimal={false}
                  allowNegative={false}
                  label={t('amenities.form.deposit')}
                  placeholder="0"
                  prefix="S/ "
                  value={form.deposit_amount}
                  onChange={(value) => set('deposit_amount', typeof value === 'number' ? value : '')}
                />
              </div>
              <Text c="dimmed" size="xs">
                {t('amenities.form.feesHint')}
              </Text>
            </>
          ) : null}

          {editing ? null : (
            <Text c="dimmed" size="xs">
              {t('amenities.form.photosAfterCreate')}
            </Text>
          )}
        </div>
      </AppDrawerBody>
      <AppDrawerFooter>
        <Button variant="default" onClick={onClose}>
          {t('actions.cancel')}
        </Button>
        <Button color="accent" disabled={conflicts || nameMissing} loading={mutation.isPending} type="submit">
          {editing ? t('locations.saveChanges') : t('amenities.create')}
        </Button>
      </AppDrawerFooter>
    </form>
  )
}
