import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Select, Textarea } from '@mantine/core'
import { notifySuccess } from '../../lib/notify'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { DangerZone, DrawerRow, DrawerSection } from '../../components/ui/detail-drawer-parts'
import { FormTextInput } from '../../components/ui/form-fields'
import { FormPhoneInput } from '../../components/ui/phone-input'
import { fieldErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { createLocation, updateLocation, type LocationPayload, type LocationSummary } from './api'
import { locationFormSchema, locationTypeValues, type LocationFormValues } from './schemas'

const DEFAULT_TIMEZONE = 'America/Lima'

// A curated list keeps the select usable; the API accepts any PHP
// identifier, so widening later costs nothing.
const TIMEZONES = [
  'America/Lima',
  'America/Bogota',
  'America/Mexico_City',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Guayaquil',
  'America/La_Paz',
  'America/Panama',
]

function locationDefaults(location?: LocationSummary | null): LocationFormValues {
  return {
    name: location?.name ?? '',
    type: location?.type ?? 'multifamily_building',
    timezone: location?.timezone ?? DEFAULT_TIMEZONE,
    address_line1: location?.address_line1 ?? '',
    address_line2: location?.address_line2 ?? '',
    district: location?.district ?? '',
    city: location?.city ?? '',
    state: location?.state ?? '',
    postal_code: location?.postal_code ?? '',
    country: location?.country ?? 'PE',
    phone: location?.phone ?? '',
    contact_email: location?.contact_email ?? '',
    access_notes: location?.access_notes ?? '',
  }
}

function toPayload(values: LocationFormValues): LocationPayload {
  const nullable = (value: string) => (value.trim() === '' ? null : value.trim())

  return {
    name: values.name.trim(),
    type: values.type,
    timezone: values.timezone,
    address_line1: values.address_line1.trim(),
    address_line2: nullable(values.address_line2),
    district: nullable(values.district),
    city: values.city.trim(),
    state: nullable(values.state),
    postal_code: nullable(values.postal_code),
    country: values.country || 'PE',
    phone: nullable(values.phone),
    contact_email: nullable(values.contact_email),
    access_notes: nullable(values.access_notes),
  }
}

/**
 * One component in two modes (06b): create and edit share the fields; the
 * mode only changes the title, the submit label, and which mutation runs.
 */
export function LocationFormDrawer({
  accountId,
  editing,
  onClose,
  onDeactivate,
  opened,
}: {
  accountId: string
  editing: LocationSummary | null
  onClose: () => void
  onDeactivate?: () => void
  opened: boolean
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const form = useForm<LocationFormValues>({
    defaultValues: locationDefaults(editing),
    resolver: zodResolver(locationFormSchema),
  })
  const { control, formState, handleSubmit, reset, setError, getValues } = form
  const formCountry = useWatch({ control, name: 'country' })

  useEffect(() => {
    if (opened) {
      reset(locationDefaults(editing))
    }
  }, [editing, opened, reset])

  const mutation = useMutation({
    mutationFn: (payload: LocationPayload) =>
      editing
        ? updateLocation(accountId, editing.id, payload)
        : createLocation(accountId, payload),
    onSuccess: async () => {
      onClose()
      await queryClient.invalidateQueries({ queryKey: ['locations'] })
      notifySuccess(editing ? t('locations.updated') : t('locations.created'))
    },
  })

  const submit = handleSubmit((values) =>
    submitHandlingServerErrors({ setError, getValues }, () =>
      mutation.mutateAsync(toPayload(values)),
    ),
  )

  const typeOptions = locationTypeValues.map((value) => ({
    label: t(`locations.types.${value}`),
    value,
  }))

  return (
    <AppDrawer
      opened={opened}
      subtitle={editing ? editing.name : t('locations.createSubtitle')}
      title={editing ? t('locations.editTitle') : t('locations.createTitle')}
      onClose={onClose}
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void submit(event)}>
        <AppDrawerBody>
            {formState.errors.root ? (
              <Alert color="error">{formState.errors.root.message}</Alert>
            ) : null}

            <FormTextInput
              control={control}
              label={t('locations.form.name')}
              name="name"
              placeholder={t('locations.form.namePlaceholder')}
            />
            <Controller
              control={control}
              name="type"
              render={({ field, fieldState }) => (
                <Select
                  allowDeselect={false}
                  data={typeOptions}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('locations.form.type')}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(value) => field.onChange(value)}
                />
              )}
            />
            <Controller
              control={control}
              name="timezone"
              render={({ field, fieldState }) => (
                <Select
                  allowDeselect={false}
                  data={TIMEZONES}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('locations.form.timezone')}
                  searchable
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(value) => field.onChange(value)}
                />
              )}
            />

            <DrawerSection label={t('locations.form.addressSection')} />
            <FormTextInput
              control={control}
              label={t('locations.form.addressLine1')}
              name="address_line1"
              placeholder={t('locations.form.addressLine1Placeholder')}
            />
            <FormTextInput
              control={control}
              label={t('locations.form.addressLine2')}
              name="address_line2"
              placeholder={t('locations.form.addressLine2Placeholder')}
            />
            <DrawerRow>
              <FormTextInput control={control} label={t('locations.form.district')} name="district" />
              <FormTextInput control={control} label={t('locations.form.city')} name="city" />
              <FormTextInput control={control} label={t('locations.form.state')} name="state" />
              <FormTextInput
                control={control}
                label={t('locations.form.postalCode')}
                name="postal_code"
              />
            </DrawerRow>
            <FormTextInput control={control} label={t('locations.form.country')} name="country" />

            <DrawerSection label={t('locations.form.contactSection')} />
            <FormPhoneInput control={control} defaultCountry={formCountry || 'PE'} label={t('locations.form.phone')} name="phone" placeholder="1 302 4410" />
            <FormTextInput
              control={control}
              label={t('locations.form.contactEmail')}
              name="contact_email"
              placeholder="operaciones@…"
            />
            <Controller
              control={control}
              name="access_notes"
              render={({ field, fieldState }) => (
                <Textarea
                  {...field}
                  description={t('locations.form.accessNotesHint')}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('locations.form.accessNotes')}
                  placeholder={t('locations.form.accessNotesPlaceholder')}
                />
              )}
            />
            {editing && onDeactivate ? (
              <DangerZone action={<Button className="w-full" color="error" variant="light" onClick={onDeactivate}> {t('locations.deactivate')} </Button>} description={t('locations.form.sensitiveZoneHint')} title={t('locations.form.sensitiveZone')} />
            ) : null}
        </AppDrawerBody>
        <AppDrawerFooter>
          <Button variant="default" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button color="accent" loading={mutation.isPending} type="submit">
            {editing ? t('locations.saveChanges') : t('locations.create')}
          </Button>
        </AppDrawerFooter>
      </form>
    </AppDrawer>
  )
}
