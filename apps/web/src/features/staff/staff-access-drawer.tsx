import { zodResolver } from '@hookform/resolvers/zod'
import {
  ActionIcon,
  Alert,
  Button,
  Drawer,
  Group,
  Select,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { AddCircle, CloseCircle } from '@solar-icons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { Controller, useFieldArray, useForm, useWatch, type FieldError } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { fieldErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { accountRoles, getRoleLabelKey, locationRoles } from '../auth/access'
import {
  createStaffInvitation,
  updateStaffAccountRole,
  updateStaffLocationAssignments,
  type StaffSummary,
} from './api'
import { staffInviteSchema, type StaffInviteFormValues } from './schemas'

type LocationOption = { value: string; label: string }

function staffDefaults(staff?: StaffSummary | null): StaffInviteFormValues {
  return {
    email: staff?.email ?? '',
    first_name: staff?.first_name ?? '',
    last_name: staff?.last_name ?? '',
    is_account_admin: staff?.account_roles.includes(accountRoles.accountAdmin) ?? false,
    location_assignments:
      staff?.location_assignments.map((assignment) => ({
        location_id: assignment.location_id,
        role: assignment.role,
      })) ?? [],
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
 * The design's "Tipo de acceso" selector card. Unlike a strict radio group,
 * both cards can be active at once — the data model allows account admins to
 * also hold location roles, and existing staff already do.
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
  opened,
}: {
  accountId: string
  editing: StaffSummary | null
  locations: LocationOption[]
  onClose: () => void
  opened: boolean
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const form = useForm<StaffInviteFormValues>({
    defaultValues: staffDefaults(),
    resolver: zodResolver(staffInviteSchema),
  })
  const assignments = useFieldArray({ control: form.control, name: 'location_assignments' })
  const isAdmin = useWatch({ control: form.control, name: 'is_account_admin' })
  const hasAssignments = assignments.fields.length > 0

  useEffect(() => {
    if (opened) {
      form.reset(staffDefaults(editing))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editing])

  const mutation = useMutation({
    mutationFn: async (values: StaffInviteFormValues) => {
      const accountRole = values.is_account_admin ? accountRoles.accountAdmin : null

      if (!editing) {
        return createStaffInvitation(accountId, {
          email: values.email,
          first_name: values.first_name,
          last_name: values.last_name,
          account_role: accountRole,
          location_assignments: values.location_assignments,
        })
      }

      // Two endpoints own the two access dimensions; both requests are
      // idempotent, so saving always sends both rather than diffing.
      await updateStaffAccountRole(accountId, editing.id, accountRole)

      return updateStaffLocationAssignments(accountId, editing.id, values.location_assignments)
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
    <Drawer
      opened={opened}
      position="right"
      size={520}
      styles={{
        content: { display: 'flex', flexDirection: 'column', maxWidth: '100vw' },
        body: { display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, paddingBottom: 0 },
      }}
      title={
        editing ? (
          <div>
            <Text fw={700} size="lg">
              {editing.name}
            </Text>
            <Text c="dimmed" size="xs">
              {editing.email}
            </Text>
          </div>
        ) : (
          <Text fw={700} size="lg">
            {t('staff.invite')}
          </Text>
        )
      }
      onClose={onClose}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto pb-5">
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
        <div className="grid gap-2.5">
          <Text c="dimmed" fw={500} size="xs">
            {t('staff.accessType')}
          </Text>
          <AccessTypeCard
            active={isAdmin}
            description={t('staff.accountAdminHint')}
            title={t(getRoleLabelKey(accountRoles.accountAdmin))}
            onActivate={() =>
              form.setValue('is_account_admin', !isAdmin, { shouldValidate: true })
            }
          />
          <AccessTypeCard
            active={hasAssignments}
            title={t('staff.locationStaff')}
            onActivate={() => {
              if (!hasAssignments) {
                appendAssignment()
              }
            }}
          >
            {hasAssignments ? (
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
                          data={locations}
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
                <Button
                  className="justify-self-start"
                  leftSection={<AddCircle size={14} />}
                  size="xs"
                  variant="subtle"
                  onClick={appendAssignment}
                >
                  {t('staff.addLocation')}
                </Button>
              </div>
            ) : null}
          </AccessTypeCard>
          {assignmentsError ? (
            <Text c="red" size="xs">
              {assignmentsError}
            </Text>
          ) : null}
        </div>
        {editing ? (
          <div className="grid gap-2 border-0 border-t border-solid border-[var(--mantine-color-default-border)] pt-5">
            <Tooltip label={t('staff.deactivateUnavailable')}>
              <Button
                className="justify-self-start"
                color="red"
                data-disabled
                variant="outline"
                onClick={(event) => event.preventDefault()}
              >
                {t('staff.deactivate')}
              </Button>
            </Tooltip>
            <Text c="dimmed" size="xs">
              {t('staff.deactivateHint')}
            </Text>
          </div>
        ) : null}
        </div>
        <Group
          justify="flex-end"
          className="border-0 border-t border-solid border-[var(--mantine-color-default-border)] py-4"
        >
          <Button variant="default" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button color="amber.4" loading={mutation.isPending} type="submit">
            {editing ? t('staff.saveChanges') : t('staff.sendInvitation')}
          </Button>
        </Group>
      </form>
    </Drawer>
  )
}
