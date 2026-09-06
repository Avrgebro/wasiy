import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Badge, Button, SegmentedControl, Select, Switch, Text } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMe, usePhoneFormat } from '../auth/hooks'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { ConfirmDialog, DangerZone, DrawerField, DrawerRow, DrawerSection } from '../../components/ui/detail-drawer-parts'
import { FormTextInput } from '../../components/ui/form-fields'
import { FormPhoneInput } from '../../components/ui/phone-input'
import { fieldErrorMessage, getErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifyError, notifySuccess, notifyWarning } from '../../lib/notify'
import { getResidents } from '../residents/api'
import {
  createMembership,
  createResidentInUnit,
  inviteResidentToPortal,
  removeMembership,
  updateMembership,
  type UnitDetail,
  type UnitMember,
} from './api'
import { memberSchema, type MemberFormValues } from './schemas'
import { portalColor } from './unit-presentation'

const EMPTY: MemberFormValues = {
  mode: 'existing',
  resident_id: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  is_primary_contact: false,
  invite: true,
}

/**
 * Mockup 12c. Add: an existing person of the account or a new one, plus the
 * relation (role, primary contact, portal invitation). Manage: the relation
 * fields for a current member, the portal block, and the sensitive zone.
 * Residents are account people; the unit only stores the relation.
 */
export function MemberDrawer({
  accountId,
  member,
  onClose,
  opened,
  unit,
}: {
  accountId: string
  /** null = add mode */
  member: UnitMember | null
  onClose: () => void
  opened: boolean
  unit: UnitDetail
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const country = useMe().data?.active_location?.country ?? 'PE'
  const formatPhone = usePhoneFormat()
  const [personSearch, setPersonSearch] = useState('')
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const form = useForm<MemberFormValues>({ defaultValues: EMPTY, resolver: zodResolver(memberSchema) })

  useEffect(() => {
    if (opened) {
      form.reset(
        member
          ? { ...EMPTY, mode: 'existing', resident_id: member.resident_id, is_primary_contact: member.is_primary_contact, invite: false }
          : EMPTY,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, member?.membership_id])

  // The search box is plain state, so it resets on the way out instead of
  // inside the effect above.
  const close = () => {
    setPersonSearch('')
    onClose()
  }

  const mode = useWatch({ control: form.control, name: 'mode' })
  const invite = useWatch({ control: form.control, name: 'invite' })

  const peopleQuery = useQuery({
    enabled: opened && !member && mode === 'existing' && personSearch.trim().length >= 2,
    queryKey: ['residents', 'options', accountId, personSearch],
    queryFn: () => getResidents(accountId, { page: 1, per_page: 20, search: personSearch.trim() }),
  })
  const alreadyHere = new Set(unit.members.map((current) => current.resident_id))
  const residentId = useWatch({ control: form.control, name: 'resident_id' })
  const selectedPersonEmail = peopleQuery.data?.data.find((person) => person.id === residentId)?.email ?? null
  const peopleOptions = (peopleQuery.data?.data ?? [])
    .filter((person) => !alreadyHere.has(person.id))
    .map((person) => ({
      value: person.id,
      label: [person.name, person.email].filter(Boolean).join(' · '),
      disabled: false,
    }))

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['registry', 'units'] }),
      queryClient.invalidateQueries({ queryKey: ['registry', 'residents'] }),
    ])

  const add = useMutation({
    mutationFn: async (values: MemberFormValues) => {
      const membership = { unit_id: unit.id, is_primary_contact: values.is_primary_contact }
      let residentId = values.resident_id
      let email: string | null = null

      if (values.mode === 'new') {
        // Creation never carries an email; the invitation step does.
        const created = await createResidentInUnit(
          accountId,
          { first_name: values.first_name, last_name: values.last_name, email: null, phone: values.phone || null },
          membership,
        )
        residentId = created.data.id
      } else {
        await createMembership(residentId, membership)
        email = peopleQuery.data?.data.find((person) => person.id === residentId)?.email ?? null
      }

      if (values.invite) {
        const address = email ?? (values.email || null)
        if (address) {
          await inviteResidentToPortal(residentId, address)
        } else {
          notifyWarning(t('units.member.inviteNeedsEmail'))
        }
      }
    },
    onSuccess: async () => {
      await invalidate()
      onClose()
      notifySuccess(t('units.member.added'))
    },
  })

  const save = useMutation({
    mutationFn: (values: MemberFormValues) =>
      updateMembership(member!.membership_id, { is_primary_contact: values.is_primary_contact }),
    onSuccess: async () => {
      await invalidate()
      onClose()
      notifySuccess(t('units.member.saved'))
    },
  })

  const inviteMutation = useMutation({
    mutationFn: () => inviteResidentToPortal(member!.resident_id),
    onSuccess: async () => {
      await invalidate()
      notifySuccess(t('units.member.invited'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: () => removeMembership(member!.membership_id),
    onSuccess: async () => {
      await invalidate()
      setConfirmingRemove(false)
      onClose()
      notifySuccess(t('units.member.removed'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  const pending = add.isPending || save.isPending

  return (
    <AppDrawer
      opened={opened}
      subtitle={member ? `${member.name} · ${unit.unit_number}` : unit.unit_number}
      title={t(member ? 'units.member.manageTitle' : 'units.member.addTitle')}
      onClose={close}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit((values) => submitHandlingServerErrors(form, () => (member ? save : add).mutateAsync(values)))}
      >
        <AppDrawerBody>
          {form.formState.errors.root?.message ? (
            <Alert color="error" title={t('errors.actionFailed')}>
              {form.formState.errors.root.message}
            </Alert>
          ) : null}

          {member ? (
            <div className="flex items-center gap-3 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-3.5 py-3">
              <div className="min-w-0">
                <Text fw={600} size="sm">
                  {member.name}
                </Text>
                <Text c="dimmed" size="xs">
                  {[member.email, formatPhone(member.phone)].filter(Boolean).join(' · ') || '—'}
                </Text>
              </div>
            </div>
          ) : (
            <>
              <Controller
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <SegmentedControl
                    {...field}
                    data={[
                      { value: 'existing', label: t('units.member.existing') },
                      { value: 'new', label: t('units.member.new') },
                    ]}
                    fullWidth
                  />
                )}
              />
              {mode === 'existing' ? (
                <Controller
                  control={form.control}
                  name="resident_id"
                  render={({ field, fieldState }) => (
                    <Select
                      {...field}
                      data={peopleOptions}
                      error={fieldErrorMessage(fieldState.error)}
                      label={t('units.member.searchPerson')}
                      nothingFoundMessage={personSearch.trim().length < 2 ? t('units.member.typeToSearch') : t('units.member.noPeople')}
                      placeholder={t('units.member.searchPlaceholder')}
                      searchable
                      searchValue={personSearch}
                      onChange={(value) => field.onChange(value ?? '')}
                      onSearchChange={setPersonSearch}
                    />
                  )}
                />
              ) : (
                <DrawerRow>
                  <FormTextInput control={form.control} label={t('registry.residents.firstName')} name="first_name" />
                  <FormTextInput control={form.control} label={t('registry.residents.lastName')} name="last_name" />
                  <div className="sm:col-span-2">
                    <FormPhoneInput control={form.control} defaultCountry={country} label={t('registry.residents.phone')} name="phone" placeholder="987 654 321" />
                  </div>
                </DrawerRow>
              )}
            </>
          )}

          <DrawerSection description={t('units.member.relationHint')} label={t('units.member.relation')} />
          <Controller
            control={form.control}
            name="is_primary_contact"
            render={({ field }) => (
              <Switch
                checked={field.value}
                label={t('units.detail.primaryContact')}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          {!member ? (
            <Controller
              control={form.control}
              name="invite"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  label={t('units.member.invite')}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
          ) : null}
          {/* The email is asked only here, for the invitation (M11). */}
          {!member && invite && (mode === 'new' || !selectedPersonEmail) ? (
            <FormTextInput autoComplete="off" control={form.control} label={t('residents.detail.emailLabel')} name="email" placeholder="nombre@correo.com" />
          ) : null}

          {member ? (
            <>
              <DrawerSection label={t('units.detail.portal')} />
              <DrawerField note={!member.email && member.portal_state !== 'active' ? t('units.member.inviteNeedsEmail') : undefined}>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-3.5 py-3">
                  <Badge color={portalColor(member.portal_state)} radius="xl" size="sm" variant="surface">
                    {t(`units.portal.${member.portal_state}`)}
                  </Badge>
                  {member.portal_state !== 'active' ? (
                    <Button
                      disabled={!member.email}
                      loading={inviteMutation.isPending}
                      size="compact-sm"
                      variant="subtle"
                      onClick={() => inviteMutation.mutate()}
                    >
                      {t(member.portal_state === 'invited' ? 'units.member.resendInvite' : 'units.member.sendInvite')}
                    </Button>
                  ) : null}
                </div>
              </DrawerField>

              <DangerZone action={<Button className="w-full" color="error" variant="light" onClick={() => setConfirmingRemove(true)}> {t('units.member.remove')} </Button>} description={t('units.member.removeHint', { unit: unit.unit_number })} title={t('units.form.sensitiveZone')} />
              <ConfirmDialog
                body={t('units.member.confirmRemoveBody')}
                opened={confirmingRemove}
                title={t('units.member.confirmRemove', { name: member.name })}
                onCancel={() => setConfirmingRemove(false)}
                onConfirm={() => remove.mutate()}
              />
            </>
          ) : null}
        </AppDrawerBody>
        <AppDrawerFooter>
          <Button variant="default" onClick={close}>
            {t(member ? 'finances.detail.close' : 'actions.cancel')}
          </Button>
          <Button color="accent" loading={pending} type="submit">
            {t(member ? 'actions.save' : 'units.member.add')}
          </Button>
        </AppDrawerFooter>
      </form>
    </AppDrawer>
  )
}
