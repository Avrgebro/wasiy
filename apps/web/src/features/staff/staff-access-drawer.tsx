import { zodResolver } from '@hookform/resolvers/zod'
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Select,
  Text,
  TextInput,
} from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { AddCircle, CloseCircle } from '@solar-icons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { Controller, useFieldArray, useForm, useWatch, type FieldError } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { fieldErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { accountRoles, getRoleLabelKey, locationRoles } from '../auth/access'
import { createStaffInvitation, updateStaffAccess, type StaffSummary } from './api'
import { staffInviteSchema, type StaffInviteFormValues } from './schemas'

type LocationOption = { value: string; label: string }

function staffDefaults(staff?: StaffSummary | null): StaffInviteFormValues {
  // When a legacy record somehow holds both access types, admin wins the
  // radio; the visible warning in the drawer covers what saving will do.
  const isAdmin = staff?.account_role === accountRoles.accountAdmin

  return {
    email: staff?.email ?? '',
    first_name: staff?.first_name ?? '',
    last_name: staff?.last_name ?? '',
    access_type: isAdmin ? 'account_admin' : 'location_staff',
    // Invites start with one empty row so the default choice is ready to
    // fill in; edits mirror the record as-is.
    location_assignments: staff
      ? staff.location_assignments.map((assignment) => ({
          location_id: assignment.location_id,
          role: assignment.role,
        }))
      : [{ location_id: '', role: locationRoles.locationManager }],
  }
}

function locationRoleOptions(t: (key: string) => string) {
  return [
    {
      label: t(getRoleLabelKey(locationRoles.locationManager)),
      value: locationRoles.locationManager,
    },
    { label: t(getRoleLabelKey(locationRoles.frontDesk)), value: locationRoles.frontDesk },
  ]
}

function AccessIndicator({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 inline-block size-[18px] shrink-0 rounded-full border-solid box-border ${
        active
          ? 'border-[5px] border-[var(--mantine-primary-color-filled)] bg-[var(--mantine-color-body)]'
          : 'border border-[var(--mantine-color-default-border)]'
      }`}
    />
  )
}

/**
 * The design's "Tipo de acceso" selector card: a radio choice — account
 * admin already implies every location, so the two access types are
 * mutually exclusive, and the API enforces the same rule.
 */
function AccessTypeCard({
  active,
  children,
  description,
  onActivate,
  title,
}: {
  active: boolean
  children?: ReactNode
  description?: string
  onActivate: () => void
  title: string
}) {
  return (
    <div
      className={`flex flex-col gap-3.5 rounded-xl border p-3.5 ${
        active
          ? 'border-[var(--mantine-primary-color-filled)] bg-[var(--mantine-color-default-hover)]'
          : 'border-[var(--mantine-color-default-border)]'
      }`}
    >
      <button
        className="flex cursor-pointer items-start gap-2.5 border-0 bg-transparent p-0 text-left"
        type="button"
        onClick={onActivate}
      >
        <AccessIndicator active={active} />
        <span className="min-w-0">
          <Text fw={600} size="sm">
            {title}
          </Text>
          {description ? (
            <Text c="dimmed" size="xs" mt={2}>
              {description}
            </Text>
          ) : null}
        </span>
      </button>
      {children}
    </div>
  )
}

/**
 * Invite and edit share one drawer because they edit the same access shape;
 * only identity differs — editable inputs when inviting, read-only header
 * when editing an existing member (there is no endpoint to rename them).
 */
export function StaffAccessDrawer({
  accountId,
  editing,
  locations,
  onClose,
  onDeactivate,
  opened,
}: {
  accountId: string
  editing: StaffSummary | null
  locations: LocationOption[]
  onClose: () => void
  /** Opens the deactivation confirmation; absent for self-edits. */
  onDeactivate?: () => void
  opened: boolean
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const form = useForm<StaffInviteFormValues>({
    defaultValues: staffDefaults(),
    resolver: zodResolver(staffInviteSchema),
  })
  const assignments = useFieldArray({ control: form.control, name: 'location_assignments' })
  const accessType = useWatch({ control: form.control, name: 'access_type' })
  const assignmentValues = useWatch({ control: form.control, name: 'location_assignments' }) ?? []
  // Each location can hold one role at most, so rows can never exceed the
  // location count, and a location chosen in one row is unavailable in the
  // others (the schema and the API enforce the same rule as a backstop).
  const selectedLocationIds = assignmentValues
    .map((assignment) => assignment?.location_id)
    .filter(Boolean)
  const canAddAssignment = assignments.fields.length < locations.length

  function locationOptionsForRow(rowIndex: number) {
    const ownValue = assignmentValues[rowIndex]?.location_id

    return locations.map((option) => ({
      ...option,
      disabled: option.value !== ownValue && selectedLocationIds.includes(option.value),
    }))
  }
  const isAdmin = accessType === 'account_admin'
  // Legacy records may hold both access types; saving as admin will clear
  // the assignments, so that consequence must be visible, not silent.
  const adminSaveDropsAssignments =
    isAdmin && (editing?.location_assignments.length ?? 0) > 0

  useEffect(() => {
    if (opened) {
      form.reset(staffDefaults(editing))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editing])

  const mutation = useMutation({
    mutationFn: async (values: StaffInviteFormValues) => {
      // The radio makes access exclusive: admin sends no assignments, and
      // location staff sends no account role — matching the API's XOR rule.
      const access =
        values.access_type === 'account_admin'
          ? { account_role: accountRoles.accountAdmin, location_assignments: [] }
          : { account_role: null, location_assignments: values.location_assignments }

      if (!editing) {
        return createStaffInvitation(accountId, {
          email: values.email,
          first_name: values.first_name,
          last_name: values.last_name,
          ...access,
        })
      }

      return updateStaffAccess(accountId, editing.id, access)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['staff'] })
      onClose()
      showNotification({
        color: 'green',
        message: editing ? t('registry.saved') : t('staff.invited'),
        title: t('registry.savedTitle'),
      })
    },
  })

  async function handleSubmit(values: StaffInviteFormValues) {
    await submitHandlingServerErrors(form, () => mutation.mutateAsync(values))
  }

  const assignmentsErrors = form.formState.errors.location_assignments
  const assignmentsError =
    fieldErrorMessage(assignmentsErrors as FieldError | undefined) ??
    fieldErrorMessage(assignmentsErrors?.root)

  function appendAssignment() {
    assignments.append({ location_id: '', role: locationRoles.locationManager })
  }

  return (
    <AppDrawer
      opened={opened}
      subtitle={editing?.email}
      title={editing ? editing.name : t('staff.invite')}
      onClose={onClose}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <AppDrawerBody>
        {form.formState.errors.root?.message ? (
          <Alert color="red" title={t('errors.actionFailed')}>
            {form.formState.errors.root.message}
          </Alert>
        ) : null}
        {editing ? null : (
          <>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="first_name"
                render={({ field, fieldState }) => (
                  <TextInput
                    {...field}
                    error={fieldErrorMessage(fieldState.error)}
                    label={t('registry.residents.firstName')}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="last_name"
                render={({ field, fieldState }) => (
                  <TextInput
                    {...field}
                    error={fieldErrorMessage(fieldState.error)}
                    label={t('registry.residents.lastName')}
                  />
                )}
              />
            </div>
            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <TextInput
                  {...field}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('auth.email')}
                  type="email"
                />
              )}
            />
          </>
        )}
        <div className="grid gap-2.5" role="radiogroup" aria-label={t('staff.accessType')}>
          <Text c="dimmed" fw={500} size="xs">
            {t('staff.accessType')}
          </Text>
          <AccessTypeCard
            active={isAdmin}
            description={t('staff.accountAdminHint')}
            title={t(getRoleLabelKey(accountRoles.accountAdmin))}
            onActivate={() =>
              form.setValue('access_type', 'account_admin', { shouldValidate: true })
            }
          />
          {adminSaveDropsAssignments ? (
            <Alert color="yellow" p="xs">
              {t('staff.adminReplacesLocations')}
            </Alert>
          ) : null}
          <AccessTypeCard
            active={!isAdmin}
            title={t('staff.locationStaff')}
            onActivate={() => {
              form.setValue('access_type', 'location_staff', { shouldValidate: true })
              if (assignments.fields.length === 0 && locations.length > 0) {
                appendAssignment()
              }
            }}
          >
            {!isAdmin ? (
              <div className="grid gap-2.5">
                {assignments.fields.map((assignmentField, index) => (
                  <Group key={assignmentField.id} align="flex-start" gap="xs" wrap="nowrap">
                    <Controller
                      control={form.control}
                      name={`location_assignments.${index}.location_id`}
                      render={({ field, fieldState }) => (
                        <Select
                          {...field}
                          aria-label={t('staff.location')}
                          className="min-w-0 flex-1"
                          data={locationOptionsForRow(index)}
                          error={fieldErrorMessage(fieldState.error)}
                          placeholder={t('staff.location')}
                        />
                      )}
                    />
                    <Controller
                      control={form.control}
                      name={`location_assignments.${index}.role`}
                      render={({ field, fieldState }) => (
                        <Select
                          {...field}
                          allowDeselect={false}
                          aria-label={t('staff.role')}
                          className="min-w-0 flex-1"
                          data={locationRoleOptions(t)}
                          error={fieldErrorMessage(fieldState.error)}
                        />
                      )}
                    />
                    <ActionIcon
                      aria-label={t('staff.removeLocation')}
                      color="gray"
                      mt={4}
                      variant="subtle"
                      onClick={() => assignments.remove(index)}
                    >
                      <CloseCircle size={16} />
                    </ActionIcon>
                  </Group>
                ))}
                {canAddAssignment ? (
                  <Button
                    className="justify-self-start"
                    leftSection={<AddCircle size={14} />}
                    size="xs"
                    variant="subtle"
                    onClick={appendAssignment}
                  >
                    {t('staff.addLocation')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </AccessTypeCard>
          {assignmentsError ? (
            <Text c="red" size="xs">
              {assignmentsError}
            </Text>
          ) : null}
        </div>
        {editing && onDeactivate && !editing.deactivated_at ? (
          <div className="grid gap-2 border-0 border-t border-solid border-[var(--mantine-color-default-border)] pt-5">
            <Button
              className="justify-self-start"
              color="red"
              variant="outline"
              onClick={onDeactivate}
            >
              {t('staff.deactivate')}
            </Button>
            <Text c="dimmed" size="xs">
              {t('staff.deactivateHint')}
            </Text>
          </div>
        ) : null}
        </AppDrawerBody>
        <AppDrawerFooter>
          <Button variant="default" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button color="amber.4" loading={mutation.isPending} type="submit">
            {editing ? t('staff.saveChanges') : t('staff.sendInvitation')}
          </Button>
        </AppDrawerFooter>
      </form>
    </AppDrawer>
  )
}
