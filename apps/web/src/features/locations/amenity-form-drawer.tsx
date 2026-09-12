import { Alert, Button, Checkbox, NumberInput, Switch, Text, Textarea, TextInput } from '@mantine/core'
import { notifySuccess } from '../../lib/notify'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { DangerZone } from '../../components/ui/detail-drawer-parts'
import { MoneyInput } from '../../components/ui/money-input'
import { DrawerRow, DrawerSection } from '../../components/ui/detail-drawer-parts'
import { ApiError } from '../../app/api-client'
import { getErrorMessage } from '../../lib/errors'
import { WEEKDAYS, type Weekday } from '../../lib/open-days'
import {
  createAmenity,
  updateAmenity,
  type AmenityPayload,
  type AmenitySummary,
} from './amenities-api'

type FormState = {
  name: string
  description: string
  is_reservable: boolean
  requires_approval: boolean
  open_days: Weekday[]
  daily_capacity: number | null
  /** Cents, like the API. */
  fee_amount_minor: number | null
  deposit_amount_minor: number | null
}

function amenityDefaults(amenity?: AmenitySummary | null): FormState {
  return {
    name: amenity?.name ?? '',
    description: amenity?.description ?? '',
    is_reservable: amenity?.is_reservable ?? true,
    requires_approval: amenity?.booking_mode === 'approval',
    // A new amenity opens every day; closing some is the exception.
    open_days: amenity ? WEEKDAYS.filter((day) => amenity.open_days.includes(day)) : [...WEEKDAYS],
    daily_capacity: amenity?.daily_capacity ?? null,
    fee_amount_minor: amenity?.fee_amount_minor ?? null,
    deposit_amount_minor: amenity?.deposit_amount_minor ?? null,
  }
}

function toPayload(form: FormState): AmenityPayload {
  return {
    name: form.name.trim(),
    description: form.description.trim() === '' ? null : form.description.trim(),
    is_reservable: form.is_reservable,
    booking_mode: form.requires_approval ? 'approval' : 'instant',
    open_days: WEEKDAYS.filter((day) => form.open_days.includes(day)),
    daily_capacity: form.daily_capacity,
    fee_amount_minor: form.fee_amount_minor,
    deposit_amount_minor: form.deposit_amount_minor,
  }
}

/**
 * The 06c drawer, after ADR 0043: básicos, then — when reservable — the
 * open weekdays, an optional daily capacity, the approval switch and the
 * two fees. A reservation is a day, so there is no schedule to edit.
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
}: {
  accountId: string
  editing: AmenitySummary | null
  locationId: string
  onClose: () => void
  onDeactivate?: () => void
  onReactivate?: () => void
  reactivating: boolean
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

  const nameMissing = form.name.trim() === ''
  // Mirror of the API rule: a reservable amenity opens on at least one day.
  const noOpenDays = form.is_reservable && form.open_days.length === 0

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()

        if (!nameMissing && !noOpenDays) {
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
            value={form.description}
            onChange={(event) => set('description', event.currentTarget.value)}
          />
          <Switch
            checked={form.is_reservable}
            description={t('amenities.form.reservableHint')}
            label={t('amenities.form.reservable')}
            onChange={(event) => set('is_reservable', event.currentTarget.checked)}
          />

          {form.is_reservable ? (
            <>
              <DrawerSection label={t('amenities.sections.booking')} />
              <Checkbox.Group
                error={noOpenDays ? t('amenities.form.openDaysRequired') : undefined}
                label={t('amenities.form.openDays')}
                value={form.open_days}
                onChange={(value) => set('open_days', value as Weekday[])}
              >
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2.5">
                  {WEEKDAYS.map((day) => (
                    <Checkbox key={day} label={t(`amenities.weekdays.${day}`)} value={day} />
                  ))}
                </div>
              </Checkbox.Group>
              <NumberInput
                allowDecimal={false}
                allowNegative={false}
                description={t('amenities.form.capacityHint')}
                label={t('amenities.form.capacity')}
                min={1}
                placeholder={t('amenities.form.capacityPlaceholder')}
                value={form.daily_capacity ?? ''}
                onChange={(value) => set('daily_capacity', typeof value === 'number' && value > 0 ? value : null)}
              />
              <Switch
                checked={form.requires_approval}
                description={t('amenities.form.approvalHint')}
                label={t('amenities.form.requiresApproval')}
                onChange={(event) => set('requires_approval', event.currentTarget.checked)}
              />

              <DrawerSection label={t('amenities.sections.fees')} />
              <DrawerRow>
                <MoneyInput
                  label={t('amenities.form.fee')}
                  placeholder="0.00"
                  value={form.fee_amount_minor}
                  onChange={(cents) => set('fee_amount_minor', cents)}
                />
                <MoneyInput
                  label={t('amenities.form.deposit')}
                  placeholder="0.00"
                  value={form.deposit_amount_minor}
                  onChange={(cents) => set('deposit_amount_minor', cents)}
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
        <Button color="accent" disabled={nameMissing || noOpenDays} loading={mutation.isPending} type="submit">
          {editing ? t('locations.saveChanges') : t('amenities.create')}
        </Button>
      </AppDrawerFooter>
    </form>
  )
}
