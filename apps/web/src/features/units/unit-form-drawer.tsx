import { zodResolver } from '@hookform/resolvers/zod'
import { AltArrowDownIcon } from '@solar-icons/react/linear'
import { Alert, Anchor, Button, Collapse, NumberInput, Select, TagsInput, Textarea, UnstyledButton } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { DangerZone, DrawerRow, DrawerSection } from '../../components/ui/detail-drawer-parts'
import { FormTextInput } from '../../components/ui/form-fields'
import { ApiError } from '../../app/api-client'
import { fieldErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifySuccess } from '../../lib/notify'
import { buildingsQueryKey, getBuildings } from '../buildings/api'
import { createUnit, updateUnit, type UnitSummary } from './api'
import { toUnitPayload, unitSchema, type UnitFormValues } from './schemas'

const TYPES = ['apartment', 'house', 'commercial', 'office'] as const

function defaults(unit?: UnitSummary | null): UnitFormValues {
  return {
    unit_number: unit?.unit_number ?? '',
    type: unit?.type ?? 'apartment',
    building_id: unit?.building_id ?? '',
    floor: unit?.floor ?? '',
    participation_share: unit?.participation_share ?? '',
    maintenance_fee: unit?.maintenance_fee ?? '',
    parking_spots: unit?.parking_spots ?? [],
    storage_rooms: unit?.storage_rooms ?? [],
    notes: unit?.notes ?? '',
  }
}

/**
 * One component in two modes (mockup 12b): create and edit share the fields;
 * the mode changes the header, the submit label and whether the sensitive
 * zone shows. Deactivation itself is confirmed by the page.
 */
export function UnitFormDrawer({
  editing,
  locationId,
  locationName,
  onClose,
  onDeactivate,
  opened,
}: {
  editing: UnitSummary | null
  locationId: string
  locationName: string
  onClose: () => void
  onDeactivate?: () => void
  opened: boolean
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const form = useForm<UnitFormValues>({ defaultValues: defaults(editing), resolver: zodResolver(unitSchema) })
  // Towers are a select only when the location has more than one (ADR 0037).
  const buildings = useQuery({ queryKey: buildingsQueryKey(locationId), queryFn: () => getBuildings(locationId) }).data?.data ?? []
  const hasTowers = buildings.length > 1
  // Parking, storage and notes are the minority case at creation; they open
  // on demand, and always when editing a unit that already has them. The
  // toggle is null until touched, so each opening derives from the unit.
  const [detailsToggle, setDetailsToggle] = useState<boolean | null>(null)
  const detailsOpen = detailsToggle ?? Boolean(editing && (editing.parking_spots.length > 0 || editing.storage_rooms.length > 0 || editing.notes))

  function close() {
    setDetailsToggle(null)
    onClose()
  }

  useEffect(() => {
    if (opened) {
      form.reset(defaults(editing))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editing?.id])

  const mutation = useMutation({
    mutationFn: (values: UnitFormValues) => {
      const payload = toUnitPayload(values)
      if (!hasTowers) payload.building_id = null

      return editing ? updateUnit(editing.id, payload) : createUnit(locationId, payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['registry', 'units'] })
      close()
      notifySuccess(t(editing ? 'units.form.saved' : 'units.form.created'))
    },
  })

  const number = (field: { onChange: (value: number | '') => void }) => (value: string | number) =>
    field.onChange(value === '' ? '' : Number(value))

  return (
    <AppDrawer
      opened={opened}
      subtitle={editing ? [editing.building_name, editing.unit_number].filter(Boolean).join(' · ') : locationName}
      title={t(editing ? 'units.form.editTitle' : 'units.form.createTitle')}
      onClose={close}
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((values) => submitHandlingServerErrors(form, () => mutation.mutateAsync(values)))}>
        <AppDrawerBody>
          {form.formState.errors.root?.message ? (
            <Alert color="error" title={t('errors.actionFailed')}>
              {form.formState.errors.root.message}
              {/* The contracted-units cap (ADR 0040): the fix lives on the subscription page. */}
              {mutation.error instanceof ApiError && mutation.error.errors?.contracted_units ? (
                <Anchor className="mt-2 block text-sm font-semibold" component={Link} to="/admin/subscription">{t('units.form.capAction')}</Anchor>
              ) : null}
            </Alert>
          ) : null}

          <DrawerSection label={t('units.form.identity')} />
          <DrawerRow cols={hasTowers ? 3 : 2}>
            <FormTextInput control={form.control} label={t('units.form.number')} name="unit_number" />
            {hasTowers ? (
              <Controller
                control={form.control}
                name="building_id"
                render={({ field, fieldState }) => (
                  <Select
                    {...field}
                    allowDeselect={false}
                    data={buildings.map((building) => ({ value: building.id, label: building.name ?? t('buildings.unnamed') }))}
                    error={fieldErrorMessage(fieldState.error)}
                    label={t('units.form.building')}
                    required
                    onChange={(value) => field.onChange(value ?? '')}
                  />
                )}
              />
            ) : null}
            <FormTextInput control={form.control} label={t('units.form.floor')} name="floor" />
          </DrawerRow>
          <Controller
            control={form.control}
            name="type"
            render={({ field, fieldState }) => (
              <Select
                {...field}
                allowDeselect={false}
                data={TYPES.map((value) => ({ value, label: t(`units.types.${value}`) }))}
                error={fieldErrorMessage(fieldState.error)}
                label={t('units.columns.type')}
                onChange={(value) => field.onChange(value ?? 'apartment')}
              />
            )}
          />

          <DrawerSection description={t('units.form.feeSectionHint')} label={t('units.form.feeSection')} />
          <div className="flex flex-col gap-5">
            <Controller
              control={form.control}
              name="maintenance_fee"
              render={({ field, fieldState }) => (
                <NumberInput
                  {...field}
                  allowDecimal={false}
                  allowNegative={false}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('units.detail.monthlyFee')}
                  prefix="S/ "
                  thousandSeparator=" "
                  onChange={number(field)}
                />
              )}
            />
            <Controller
              control={form.control}
              name="participation_share"
              render={({ field, fieldState }) => (
                <NumberInput
                  {...field}
                  allowNegative={false}
                  decimalScale={3}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('units.form.share')}
                  suffix=" %"
                  onChange={number(field)}
                />
              )}
            />
          </div>

          <UnstyledButton
            aria-expanded={detailsOpen}
            className="flex w-full items-center justify-between rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-3.5 py-3 text-sm font-semibold"
            onClick={() => setDetailsToggle(!detailsOpen)}
          >
            <span className="flex flex-col items-start gap-0.5 text-left">
              <span>{t('units.form.moreDetails')}</span>
              <span className="text-xs font-normal text-[var(--mantine-color-dimmed)]">{t('units.form.moreDetailsHint')}</span>
            </span>
            <AltArrowDownIcon aria-hidden className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`} size={16} />
          </UnstyledButton>
          <Collapse expanded={detailsOpen} keepMounted>
            <div className="flex flex-col gap-5 pt-1">
              {/* One chip per label; Enter or a comma adds the next. */}
              <Controller
                control={form.control}
                name="parking_spots"
                render={({ field, fieldState }) => (
                  <TagsInput
                    {...field}
                    error={fieldErrorMessage(fieldState.error)}
                    label={t('units.form.parking')}
                    placeholder="E-12"
                    splitChars={[',', ' ']}
                    onChange={(value) => field.onChange(value.map((label) => label.trim().toUpperCase()).filter(Boolean))}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="storage_rooms"
                render={({ field, fieldState }) => (
                  <TagsInput
                    {...field}
                    error={fieldErrorMessage(fieldState.error)}
                    label={t('units.form.storage')}
                    placeholder="D-04"
                    splitChars={[',', ' ']}
                    onChange={(value) => field.onChange(value.map((label) => label.trim().toUpperCase()).filter(Boolean))}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="notes"
                render={({ field, fieldState }) => (
                  <Textarea {...field} error={fieldErrorMessage(fieldState.error)} label={t('registry.notes')} rows={3} />
                )}
              />
            </div>
          </Collapse>

          {editing && onDeactivate && editing.status === 'active' ? (
            <DangerZone action={<Button className="w-full" color="error" variant="light" onClick={onDeactivate}> {t('units.form.deactivate')} </Button>} description={t('units.form.sensitiveZoneHint')} title={t('units.form.sensitiveZone')} />
          ) : null}
        </AppDrawerBody>
        <AppDrawerFooter>
          <Button variant="default" onClick={close}>
            {t('actions.cancel')}
          </Button>
          <Button color="accent" loading={mutation.isPending} type="submit">
            {t(editing ? 'units.form.save' : 'units.form.create')}
          </Button>
        </AppDrawerFooter>
      </form>
    </AppDrawer>
  )
}
