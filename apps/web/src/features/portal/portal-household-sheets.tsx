import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, SegmentedControl, Text, TextInput } from '@mantine/core'
import { PhoneCalling } from '@solar-icons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { BottomSheet, ConfirmSheet, SheetAction, SheetRow, SheetRows } from '../../components/ui/bottom-sheet'
import { FormTextInput } from '../../components/ui/form-fields'
import { FormPhoneInput } from '../../components/ui/phone-input'
import { fieldErrorMessage, getErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifyError, notifySuccess } from '../../lib/notify'
import { formatPhone, telHref } from '../../lib/phone'
import { addHouseholdMember, PORTAL_RESIDENT_TYPES, removeHouseholdMember, resendHouseholdInvitation, type HouseholdMember } from './api'
import { StatusPill } from './portal-cards'
import { householdMemberSchema, type HouseholdMemberFormValues } from './schemas'

const householdKey = (unitId: string) => ['portal', 'household', unitId] as const

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}

/** "desde marzo 2025" */
function sinceLabel(iso: string | null) {
  if (!iso) return null

  return new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
}

/** Persona (Portal 04d): read-only card with the call as the one universal action; the primary contact also re-invites and removes. */
export function MemberSheet({
  canManage,
  country,
  member,
  onClose,
  unitLabel,
}: {
  canManage: boolean
  country: string
  member: HouseholdMember | null
  onClose: () => void
  unitLabel: string
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const resend = useMutation({
    mutationFn: (membershipId: string) => resendHouseholdInvitation(membershipId),
    onSuccess: () => notifySuccess(t('portal.household.invitationResent')),
    onError: (error) => notifyError(getErrorMessage(error)),
  })
  const remove = useMutation({
    mutationFn: (membershipId: string) => removeHouseholdMember(membershipId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portal', 'household'] })
      setConfirming(false)
      onClose()
      notifySuccess(t('portal.household.removed'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  const removable = canManage && member !== null && !member.is_primary_contact && !member.is_me
  const since = sinceLabel(member?.started_at ?? null)

  return (
    <>
      <BottomSheet
        footer={
          member && (removable || (canManage && member.portal_state === 'invited')) ? (
            <SheetAction>
              {canManage && member.portal_state === 'invited' ? (
                <Button className="w-full" color="accent" loading={resend.isPending} onClick={() => resend.mutate(member.membership_id)}>
                  {t('portal.household.resendInvitation')}
                </Button>
              ) : null}
              {removable ? (
                <Button className="w-full" color="error" h={44} variant="subtle" onClick={() => setConfirming(true)}>
                  {t('portal.household.remove')}
                </Button>
              ) : null}
            </SheetAction>
          ) : undefined
        }
        leading={member ? <span aria-hidden className="grid size-12 place-items-center rounded-full border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] text-base font-semibold text-[var(--wa-interactive)]">{initials(member.name)}</span> : undefined}
        lines={member ? [[member.resident_type ? t(`portal.household.types.${member.resident_type}`) : null, since ? t('portal.household.since', { date: since }) : null].filter(Boolean).join(' · ')] : []}
        opened={member !== null}
        pill={member?.is_primary_contact ? <StatusPill color="teal">{t('portal.primaryContact')}</StatusPill> : member?.is_me ? <StatusPill color="teal">{t('portal.household.you')}</StatusPill> : undefined}
        title={member?.name ?? ''}
        withClose
        onClose={onClose}
      >
        {member ? (
          <SheetRows>
            <SheetRow
              label={t('portal.phone')}
              value={
                member.phone ? (
                  <a className="inline-flex items-center gap-1.5 text-[var(--wa-interactive)] no-underline" href={telHref(member.phone)}>
                    {formatPhone(member.phone, country)}
                    <PhoneCalling aria-hidden size={14} />
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <SheetRow label={t('portal.household.portalAccess')} value={<StatusPill color={member.portal_state === 'active' ? 'success' : member.portal_state === 'invited' ? 'warning' : 'gray'}>{t(`portal.household.portalStates.${member.portal_state}`)}</StatusPill>} />
          </SheetRows>
        ) : null}
      </BottomSheet>

      <ConfirmSheet
        body={t('portal.household.removeBody')}
        confirmLabel={t('portal.household.removeConfirm')}
        opened={confirming}
        pending={remove.isPending}
        title={t('portal.household.removeTitle', { name: member?.name ?? '', unit: unitLabel })}
        onCancel={() => setConfirming(false)}
        onConfirm={() => member && remove.mutate(member.membership_id)}
      />
    </>
  )
}

const EMPTY: HouseholdMemberFormValues = { first_name: '', last_name: '', phone: '', email: '', resident_type: 'occupant' }

/** Agregar persona (Portal 04c). */
export function AddMemberSheet({ country, onClose, opened, unitId }: { country: string; onClose: () => void; opened: boolean; unitId: string }) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const form = useForm<HouseholdMemberFormValues>({ defaultValues: EMPTY, resolver: zodResolver(householdMemberSchema) })

  useEffect(() => {
    if (opened) form.reset(EMPTY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened])

  const mutation = useMutation({
    mutationFn: (values: HouseholdMemberFormValues) =>
      addHouseholdMember({
        unit_id: unitId,
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone || null,
        email: values.email || null,
        resident_type: values.resident_type,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: householdKey(unitId) })
      onClose()
      notifySuccess(result.data.portal_state === 'invited' ? t('portal.household.addedInvited', { name: result.data.first_name }) : t('portal.household.added', { name: result.data.first_name }))
    },
  })

  const rootError = form.formState.errors.root?.message

  return (
    <BottomSheet
      footer={
        <SheetAction hint={t('portal.household.addHint')}>
          <Button className="w-full" color="accent" form="add-member-form" loading={mutation.isPending} type="submit">
            {t('portal.household.addSubmit')}
          </Button>
        </SheetAction>
      }
      opened={opened}
      title={t('portal.household.add')}
      withClose
      onClose={onClose}
    >
      <form className="flex flex-col gap-[11px]" id="add-member-form" onSubmit={form.handleSubmit((values) => submitHandlingServerErrors(form, () => mutation.mutateAsync(values)))}>
        {rootError ? (
          <Alert color="error" title={t('errors.actionFailed')}>
            {rootError}
          </Alert>
        ) : null}
        <div className="grid grid-cols-2 gap-2.5">
          <FormTextInput autoComplete="off" control={form.control} label={t('portal.household.firstName')} name="first_name" />
          <FormTextInput autoComplete="off" control={form.control} label={t('portal.household.lastName')} name="last_name" />
        </div>
        <FormPhoneInput control={form.control} defaultCountry={country} label={t('portal.phone')} name="phone" placeholder="987 654 321" />
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <TextInput {...field} autoComplete="off" description={t('portal.household.emailHint')} error={fieldErrorMessage(fieldState.error)} inputWrapperOrder={['label', 'input', 'description', 'error']} label={t('portal.household.emailOptional')} placeholder="nombre@correo.com" />
          )}
        />
        <Controller
          control={form.control}
          name="resident_type"
          render={({ field }) => (
            <div>
              <Text c="dimmed" component="label" fw={600} size="xs">
                {t('portal.household.type')}
              </Text>
              <SegmentedControl
                fullWidth
                data={PORTAL_RESIDENT_TYPES.map((value) => ({ value, label: t(`portal.household.types.${value}`) }))}
                mt={5}
                value={field.value}
                onChange={(value) => field.onChange(value)}
              />
            </div>
          )}
        />
      </form>
    </BottomSheet>
  )
}
