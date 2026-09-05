import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Select, Switch } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { DrawerSection } from '../../components/ui/detail-drawer-parts'
import { FormTextInput } from '../../components/ui/form-fields'
import { fieldErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifySuccess } from '../../lib/notify'
import { useActiveUnitOptions } from '../units/use-active-unit-options'
import { createPerson, updatePerson, type ResidentSummary } from './api'
import { personSchema, type PersonFormValues } from './schemas'

function defaults(person?: ResidentSummary | null): PersonFormValues {
  return {
    first_name: person?.first_name ?? '',
    last_name: person?.last_name ?? '',
    phone: person?.phone ?? '',
    unit_id: '',
    is_primary_contact: false,
  }
}

/**
 * Mockup 15b. One form creates and edits: names and phone. The unit relation
 * is offered only when creating; afterwards memberships live on the unit
 * page. No email here, ever — it is asked when inviting to the portal.
 */
export function PersonFormDrawer({
  accountId,
  editing,
  locationId,
  locationName,
  onClose,
  opened,
}: {
  accountId: string
  editing: ResidentSummary | null
  locationId: string
  locationName: string
  onClose: () => void
  opened: boolean
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const form = useForm<PersonFormValues>({ defaultValues: defaults(editing), resolver: zodResolver(personSchema) })
  const unitOptions = useActiveUnitOptions(opened && !editing ? { id: locationId } : null)

  useEffect(() => {
    if (opened) {
      form.reset(defaults(editing))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editing?.id])

  const mutation = useMutation({
    mutationFn: (values: PersonFormValues) => {
      const person = { first_name: values.first_name, last_name: values.last_name, phone: values.phone || null }

      return editing
        ? updatePerson(editing.id, person)
        : createPerson(
            accountId,
            person,
            { unit_id: values.unit_id, is_primary_contact: values.is_primary_contact },
          )
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['registry', 'residents'] }),
        queryClient.invalidateQueries({ queryKey: ['registry', 'units'] }),
      ])
      onClose()
      notifySuccess(t(editing ? 'residents.form.saved' : 'residents.form.created'))
    },
  })

  return (
    <AppDrawer
      opened={opened}
      subtitle={editing ? editing.name : locationName}
      title={t(editing ? 'residents.form.editTitle' : 'residents.form.createTitle')}
      onClose={onClose}
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((values) => submitHandlingServerErrors(form, () => mutation.mutateAsync(values)))}>
        <AppDrawerBody>
          {form.formState.errors.root?.message ? (
            <Alert color="error" title={t('errors.actionFailed')}>
              {form.formState.errors.root.message}
            </Alert>
          ) : null}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-3.5">
            <FormTextInput control={form.control} label={t('registry.residents.firstName')} name="first_name" />
            <FormTextInput control={form.control} label={t('registry.residents.lastName')} name="last_name" />
          </div>
          <FormTextInput control={form.control} label={t('residents.form.phone')} name="phone" placeholder="+51 9…" />
          {!editing ? (
            <>
              <DrawerSection label={t('residents.form.unitSection')} />
              <Controller
                control={form.control}
                name="unit_id"
                render={({ field, fieldState }) => (
                  <Select
                    {...field}
                    data={unitOptions}
                    description={t('residents.form.unitHint')}
                    error={fieldErrorMessage(fieldState.error)}
                    label={t('registry.residents.unit')}
                    required
                    searchable
                    onChange={(value) => field.onChange(value ?? '')}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="is_primary_contact"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    description={t('units.member.primaryHint')}
                    label={t('units.detail.primaryContact')}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
            </>
          ) : null}
        </AppDrawerBody>
        <AppDrawerFooter>
          <Button variant="default" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button color="accent" loading={mutation.isPending} type="submit">
            {t(editing ? 'actions.save' : 'residents.form.create')}
          </Button>
        </AppDrawerFooter>
      </form>
    </AppDrawer>
  )
}
