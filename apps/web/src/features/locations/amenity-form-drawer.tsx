import { Alert, Button, NumberInput, Select, Switch, Text, Textarea, TextInput } from '@mantine/core'
import { notifySuccess } from '../../lib/notify'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { DangerZone } from '../../components/ui/detail-drawer-parts'
import { DrawerRow, DrawerSection } from '../../components/ui/detail-drawer-parts'
import { ApiError } from '../../app/api-client'
import { getErrorMessage } from '../../lib/errors'
import {
  createAmenity,
  updateAmenity,
  type AmenityPayload,
  type AmenitySummary,
  type Availability,
} from './amenities-api'
import { AmenityAvailabilityEditor } from './amenity-availability-editor'
import { availabilityHasConflicts, WEEKDAYS } from './amenity-schedule'
import { SLOT_MINUTES_OPTIONS, slotLengthLabel } from './amenity-slots'

type FormState = {
  name: string
  description: string
  is_reservable: boolean
  requires_approval: boolean
  availability: Availability
  slot_minutes: number
  fee_amount: number | ''
  deposit_amount: number | ''
}



function amenityDefaults(amenity?: AmenitySummary | null): FormState {
  return {
    name: amenity?.name ?? '',
    description: amenity?.description ?? '',
    is_reservable: amenity?.is_reservable ?? true,
    requires_approval: amenity?.booking_mode === 'approval',
    availability: amenity?.availability ?? {},
    slot_minutes: amenity?.slot_minutes ?? 60,
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
    description: form.description.trim() === '' ? null : form.description.trim(),
    is_reservable: form.is_reservable,
    booking_mode: form.requires_approval ? 'approval' : 'instant',
    availability,
    slot_minutes: form.slot_minutes,
    fee_amount: form.fee_amount === '' ? null : form.fee_amount,
    deposit_amount: form.deposit_amount === '' ? null : form.deposit_amount,
  }
}

/**
 * The 06c drawer, after ADR 0041: básicos, disponibilidad, reserva (slot
 * length and approval), cuotas. No booking policy — a reservation is an
 * exclusive run of slots inside the schedule, nothing else to configure.
 * Photos are managed from the edit flow once the amenity exists.
 */
export function AmenityFormDrawer({
  accountId,
  editing,
  locationId,
  onClose,
  onDeactivate,
  onReactivate,
  opened,
  reactivating = false,
  timezone,
}: {
  accountId: string
  editing: AmenitySummary | null
  locationId: string
  onClose: () => void
  /** Opens the deactivate confirmation; the row has no actions column, the drawer carries it. */
  onDeactivate?: () => void
  onReactivate?: () => void
  opened: boolean
  reactivating?: boolean
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
        reactivating={reactivating}
        timezone={timezone}
        onClose={onClose}
        onDeactivate={onDeactivate}
        onReactivate={onReactivate}
      />
    </AppDrawer>
  )
}

function AmenityForm({
  accountId,
  editing,
  locationId,
  onClose,
  onDeactivate,
  onReactivate,
  reactivating,
  timezone,
}: {
  accountId: string
  editing: AmenitySummary | null
  locationId: string
  onClose: () => void
  onDeactivate?: () => void
  onReactivate?: () => void
  reactivating: boolean
  timezone: string
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(amenityDefaults(editing))
  const [serverError, setServerError] = useState<string | null>(null)

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
          {serverError ? <Alert color="error">{serverError}</Alert> : null}

          <DrawerSection label={t('amenities.sections.basics')} />
          <TextInput
            label={t('amenities.form.name')}
            placeholder={t('amenities.form.namePlaceholder')}
            required
            value={form.name}
            onChange={(event) => set('name', event.currentTarget.value)}
          />
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

          <DrawerSection label={t('amenities.sections.availability')} />
          <AmenityAvailabilityEditor
            readOnly={false}
            timezone={timezone}
            value={form.availability}
            onChange={(availability) => set('availability', availability)}
          />

          {form.is_reservable ? (
            <>
              <DrawerSection label={t('amenities.sections.booking')} />
              <Select
                allowDeselect={false}
                data={SLOT_MINUTES_OPTIONS.map((minutes) => ({ value: String(minutes), label: slotLengthLabel(minutes, t) }))}
                description={t('amenities.form.slotLengthHint')}
                label={t('amenities.form.slotLength')}
                value={String(form.slot_minutes)}
                onChange={(value) => value && set('slot_minutes', Number(value))}
              />
              <Switch
                checked={form.requires_approval}
                description={t('amenities.form.approvalHint')}
                label={t('amenities.form.requiresApproval')}
                onChange={(event) => set('requires_approval', event.currentTarget.checked)}
              />

              <DrawerSection label={t('amenities.sections.fees')} />
              <DrawerRow>
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
              </DrawerRow>
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
          {editing && editing.status === 'deactivated' && onReactivate ? (
            <DangerZone
              action={
                <Button className="w-full" loading={reactivating} variant="default" onClick={onReactivate}>
                  {t('locations.reactivate')}
                </Button>
              }
              description={t('amenities.reactivateHint')}
              title={t('units.form.sensitiveZone')}
            />
          ) : editing && editing.status !== 'deactivated' && onDeactivate ? (
            <DangerZone
              action={
                <Button className="w-full" color="error" variant="light" onClick={onDeactivate}>
                  {t('locations.deactivate')}
                </Button>
              }
              description={t('amenities.deactivateHint')}
              title={t('units.form.sensitiveZone')}
            />
          ) : null}
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
