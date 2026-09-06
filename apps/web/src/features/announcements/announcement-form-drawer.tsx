import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, SegmentedControl, Switch, Text, TextInput } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { DrawerField, DrawerRow, DrawerSection } from '../../components/ui/detail-drawer-parts'
import { FormTextInput } from '../../components/ui/form-fields'
import { fieldErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifySuccess } from '../../lib/notify'
import { todayIn } from '../finances/month'
import { AnnouncementEditor } from './announcement-editor'
import { createAnnouncement, updateAnnouncement, type AnnouncementPayload, type AnnouncementSummary } from './api'
import { announcementFormSchema, type AnnouncementFormValues } from './schemas'

/**
 * Mockup 18b: one drawer, two publication modes. Create publishes now or
 * schedules; edit keeps a live post's publication time and never re-notifies.
 */
export function AnnouncementFormDrawer({
  editing,
  locationId,
  locationName,
  onClose,
  opened,
  timezone,
}: {
  editing: AnnouncementSummary | null
  locationId: string
  locationName: string
  onClose: () => void
  opened: boolean
  timezone: string
}) {
  const { t } = useTranslation('common')

  return (
    <AppDrawer
      opened={opened}
      subtitle={editing ? editing.title : t('announcements.form.subtitle', { location: locationName })}
      title={t(editing ? 'announcements.form.editTitle' : 'announcements.form.createTitle')}
      onClose={onClose}
    >
      {/* The drawer stays mounted for its transition; the form (and the editor inside) remounts per open. */}
      <AnnouncementForm key={`${editing?.id ?? 'new'}-${opened}`} editing={editing} locationId={locationId} timezone={timezone} onClose={onClose} />
    </AppDrawer>
  )
}

function defaults(editing: AnnouncementSummary | null, timezone: string): AnnouncementFormValues {
  if (!editing) {
    return { title: '', body_md: '', is_important: false, mode: 'now', publish_date: '', publish_time: '08:00', expires_on: '' }
  }
  const scheduled = editing.published_at === null
  const local = scheduled ? wallClock(editing.publish_at, timezone) : { date: '', time: '08:00' }

  return {
    title: editing.title,
    body_md: editing.body_md,
    is_important: editing.is_important,
    mode: scheduled ? 'scheduled' : 'now',
    publish_date: local.date,
    publish_time: local.time,
    expires_on: editing.expires_on ?? '',
  }
}

/** An instant as the location's wall clock, split for the two inputs. */
function wallClock(iso: string, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''

  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

function AnnouncementForm({
  editing,
  locationId,
  onClose,
  timezone,
}: {
  editing: AnnouncementSummary | null
  locationId: string
  onClose: () => void
  timezone: string
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const form = useForm<AnnouncementFormValues>({ defaultValues: defaults(editing, timezone), resolver: zodResolver(announcementFormSchema) })
  const mode = useWatch({ control: form.control, name: 'mode' })
  // A live post keeps its publication time: the segment is not offered when editing one.
  const live = editing !== null && editing.published_at !== null

  const mutation = useMutation({
    mutationFn: (values: AnnouncementFormValues) => {
      const payload: AnnouncementPayload = {
        title: values.title,
        body_md: values.body_md,
        is_important: values.is_important,
        expires_on: values.expires_on || null,
      }
      if (!live) {
        payload.publish_at = values.mode === 'scheduled' ? `${values.publish_date} ${values.publish_time}` : null
      }

      return editing ? updateAnnouncement(editing.id, payload) : createAnnouncement(locationId, payload)
    },
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ['announcements'] })
      onClose()
      notifySuccess(t(editing ? 'announcements.saved' : data.status === 'scheduled' ? 'announcements.scheduled' : 'announcements.published', { count: data.notified_count }))
    },
  })

  const submitLabel = editing ? t('actions.saveChanges') : mode === 'scheduled' ? t('announcements.form.submitSchedule') : t('announcements.form.submitPublish')

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((values) => submitHandlingServerErrors(form, () => mutation.mutateAsync(values)))}>
      <AppDrawerBody>
        {form.formState.errors.root?.message ? (
          <Alert color="error" title={t('errors.actionFailed')}>
            {form.formState.errors.root.message}
          </Alert>
        ) : null}

        <FormTextInput control={form.control} label={t('announcements.form.title')} name="title" placeholder={t('announcements.form.titlePlaceholder')} withAsterisk />
        <Controller
          control={form.control}
          name="body_md"
          render={({ field, fieldState }) => (
            <AnnouncementEditor error={fieldErrorMessage(fieldState.error)} hint={t('announcements.form.bodyHint')} label={t('announcements.form.body')} value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={form.control}
          name="is_important"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-3.5 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-3.5 py-3">
              <div className="min-w-0">
                <Text fw={600} size="sm">
                  {t('announcements.form.important')}
                </Text>
                <Text c="dimmed" size="xs">
                  {t('announcements.form.importantHint')}
                </Text>
              </div>
              <Switch aria-label={t('announcements.form.important')} checked={field.value} color="accent" onChange={(event) => field.onChange(event.currentTarget.checked)} />
            </div>
          )}
        />

        {live ? null : (
          <>
            <DrawerSection label={t('announcements.form.publication')} />
            <Controller
              control={form.control}
              name="mode"
              render={({ field }) => (
                <SegmentedControl
                  {...field}
                  data={[
                    { value: 'now', label: t('announcements.form.publishNow') },
                    { value: 'scheduled', label: t('announcements.form.schedule') },
                  ]}
                  fullWidth
                />
              )}
            />
            {mode === 'scheduled' ? (
              <DrawerField note={t('announcements.form.scheduleHint')}>
                <DrawerRow>
                  <Controller
                    control={form.control}
                    name="publish_date"
                    render={({ field, fieldState }) => <TextInput {...field} error={fieldErrorMessage(fieldState.error)} label={t('announcements.form.date')} min={todayIn(timezone)} type="date" />}
                  />
                  <Controller
                    control={form.control}
                    name="publish_time"
                    render={({ field, fieldState }) => <TextInput {...field} error={fieldErrorMessage(fieldState.error)} label={t('announcements.form.time')} type="time" />}
                  />
                </DrawerRow>
              </DrawerField>
            ) : null}
          </>
        )}

        <DrawerSection label={t('announcements.form.validity')} />
        <Controller
          control={form.control}
          name="expires_on"
          render={({ field, fieldState }) => (
            <TextInput {...field} description={t('announcements.form.expiresHint')} error={fieldErrorMessage(fieldState.error)} label={t('announcements.form.expiresOn')} type="date" />
          )}
        />
      </AppDrawerBody>
      <AppDrawerFooter>
        <Button variant="default" onClick={onClose}>
          {t('actions.cancel')}
        </Button>
        <Button color="accent" loading={mutation.isPending} type="submit">
          {submitLabel}
        </Button>
      </AppDrawerFooter>
    </form>
  )
}
