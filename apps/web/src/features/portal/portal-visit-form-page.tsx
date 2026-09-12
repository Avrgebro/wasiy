import { zodResolver } from '@hookform/resolvers/zod'
import { AltArrowLeftIcon } from '@solar-icons/react/linear'
import { ActionIcon, Alert, Button, SegmentedControl, Text, TextInput, Textarea } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { DateField } from '../../components/ui/date-field'
import { FormTextInput } from '../../components/ui/form-fields'
import { fieldErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifySuccess } from '../../lib/notify'
import { useMe } from '../auth/hooks'
import { useActiveUnit } from './active-unit-context'
import { preRegisterVisit } from './api'
import { preRegisterSchema, type PreRegisterFormValues } from './schemas'

function todayIn(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** Pre-registrar visita (Portal 01c): a full-screen sheet with one field per row and a pinned action. */
export function PortalVisitFormPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const me = useMe().data
  const { active } = useActiveUnit()
  const timezone = me?.active_location?.timezone ?? 'America/Lima'
  const today = todayIn(timezone)

  const form = useForm<PreRegisterFormValues>({
    defaultValues: { visitor_name: '', document: '', when: 'today', expected_on: today, expected_time: '', notes: '' },
    resolver: zodResolver(preRegisterSchema),
  })
  const when = useWatch({ control: form.control, name: 'when' })

  const mutation = useMutation({
    mutationFn: (values: PreRegisterFormValues) =>
      preRegisterVisit({
        unit_id: active!.unit_id,
        visitor_name: values.visitor_name,
        document: values.document || null,
        expected_on: values.when === 'today' ? today : values.expected_on,
        expected_time: values.expected_time || null,
        notes: values.notes || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portal', 'visits'] })
      notifySuccess(t('portal.visits.registered'))
      void navigate({ to: '/portal/visitas' })
    },
  })

  if (!active) {
    return (
      <Text c="dimmed" size="sm">
        {t('portal.noUnit')}
      </Text>
    )
  }

  return (
    <form className="flex min-h-[calc(100dvh-8rem)] flex-col gap-5" onSubmit={form.handleSubmit((values) => submitHandlingServerErrors(form, () => mutation.mutateAsync(values)))}>
      <div className="flex items-center gap-2">
        <ActionIcon aria-label={t('actions.back')} radius={10} size={40} variant="default" onClick={() => void navigate({ to: '/portal/visitas' })}>
          <AltArrowLeftIcon size={18} />
        </ActionIcon>
        <h1 className="m-0 text-xl font-bold">{t('portal.visits.preRegister')}</h1>
      </div>
      <Text c="dimmed" size="sm">
        {t('portal.visits.form.intro')}
      </Text>

      {form.formState.errors.root?.message ? (
        <Alert color="error" title={t('errors.actionFailed')}>
          {form.formState.errors.root.message}
        </Alert>
      ) : null}

      <FormTextInput control={form.control} label={t('portal.visits.form.visitor')} name="visitor_name" placeholder="Jorge Peña" />
      <FormTextInput control={form.control} label={t('portal.visits.form.documentOptional')} name="document" placeholder={t('portal.visits.form.documentPlaceholder')} />

      <Controller
        control={form.control}
        name="when"
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <Text component="label" fw={500} size="sm">
              {t('portal.visits.form.date')}
            </Text>
            <SegmentedControl
              data={[
                { label: t('portal.visits.today'), value: 'today' },
                { label: t('portal.visits.form.otherDay'), value: 'other' },
              ]}
              fullWidth
              value={field.value}
              onChange={field.onChange}
            />
          </div>
        )}
      />
      {when === 'other' ? (
        <Controller
          control={form.control}
          name="expected_on"
          render={({ field, fieldState }) => (
            <DateField error={fieldErrorMessage(fieldState.error)} label={t('portal.visits.form.whichDay')} minDate={today} value={field.value} onBlur={field.onBlur} onChange={field.onChange} />
          )}
        />
      ) : null}
      <Controller
        control={form.control}
        name="expected_time"
        render={({ field, fieldState }) => (
          <TextInput {...field} error={fieldErrorMessage(fieldState.error)} label={t('portal.visits.form.timeOptional')} type="time" />
        )}
      />
      <Controller
        control={form.control}
        name="notes"
        render={({ field, fieldState }) => (
          <Textarea {...field} error={fieldErrorMessage(fieldState.error)} label={t('portal.visits.form.noteOptional')} placeholder={t('portal.visits.form.notePlaceholder')} />
        )}
      />

      <div className="mt-auto pt-2">
        <Button className="w-full" color="accent" loading={mutation.isPending} size="md" type="submit">
          {t('portal.visits.preRegister')}
        </Button>
      </div>
    </form>
  )
}
