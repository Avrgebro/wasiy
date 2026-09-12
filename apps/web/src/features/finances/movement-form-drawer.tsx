import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, SegmentedControl, Select, Textarea, TextInput } from '@mantine/core'
import { DateField } from '../../components/ui/date-field'
import { DrawerRow } from '../../components/ui/detail-drawer-parts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { MoneyInput } from '../../components/ui/money-input'
import { fieldErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { notifySuccess } from '../../lib/notify'
import { useActiveUnitOptions } from '../units/use-active-unit-options'
import { recordMovement, type MovementCategory, type MovementStatus } from './api'
import { todayIn } from './month'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  movementFormSchema,
  type MovementFormValues,
} from './schemas'

function emptyValues(today: string): MovementFormValues {
  return {
    direction: 'expense',
    category: '',
    amount_minor: null,
    concept: '',
    detail: '',
    counterparty: '',
    unit_id: '',
    occurred_on: today,
    due_on: '',
    status: 'pending',
    note: '',
  }
}

/**
 * Manual ledger entry: building expenses and ad hoc income. Reservation
 * fees and deposits normally arrive through approvals, but the categories
 * stay available for bookings made outside Wasiy.
 */
export function MovementFormDrawer({
  accountId,
  locationId,
  onClose,
  opened,
  timezone,
}: {
  accountId: string
  locationId: string
  onClose: () => void
  opened: boolean
  timezone: string
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const form = useForm<MovementFormValues>({
    defaultValues: emptyValues(todayIn(timezone)),
    resolver: zodResolver(movementFormSchema),
  })

  useEffect(() => {
    if (opened) {
      form.reset(emptyValues(todayIn(timezone)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened])

  const direction = useWatch({ control: form.control, name: 'direction' })
  const category = useWatch({ control: form.control, name: 'category' })
  const unitOptions = useActiveUnitOptions(opened ? { id: locationId } : null)

  const categories = direction === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
  const categoryOptions = categories.map((value) => ({
    value,
    label: t(`finances.categories.${value}`),
  }))
  // A deposit starts pending or held; everything else pending or paid.
  const settledStatus: MovementStatus = category === 'reservation_deposit' ? 'held' : 'paid'
  const statusOptions = [
    { value: 'pending', label: t('finances.form.statusPending') },
    { value: settledStatus, label: t(`finances.form.status${settledStatus === 'held' ? 'Held' : 'Paid'}`) },
  ]

  const mutation = useMutation({
    mutationFn: (values: MovementFormValues) =>
      recordMovement(accountId, locationId, {
        direction: values.direction,
        category: values.category as MovementCategory,
        status: values.status,
        amount_minor: values.amount_minor as number,
        concept: values.concept.trim(),
        detail: values.detail.trim() || null,
        counterparty: values.direction === 'expense' ? values.counterparty.trim() || null : null,
        unit_id: values.direction === 'income' ? values.unit_id || null : null,
        occurred_on: values.occurred_on,
        due_on: values.due_on || null,
        note: values.note.trim() || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finances'] })
      onClose()
      notifySuccess(t('finances.form.recorded'))
    },
  })

  async function handleSubmit(values: MovementFormValues) {
    await submitHandlingServerErrors(form, () => mutation.mutateAsync(values))
  }

  return (
    <AppDrawer
      opened={opened}
      subtitle={t('finances.form.subtitle')}
      title={t('finances.record')}
      onClose={onClose}
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit(handleSubmit)}>
        <AppDrawerBody>
          {form.formState.errors.root?.message ? (
            <Alert color="error" title={t('errors.actionFailed')}>
              {form.formState.errors.root.message}
            </Alert>
          ) : null}
          <Controller
            control={form.control}
            name="direction"
            render={({ field }) => (
              <SegmentedControl
                {...field}
                data={[
                  { value: 'expense', label: t('finances.form.expense') },
                  { value: 'income', label: t('finances.form.income') },
                ]}
                fullWidth
                onChange={(value) => {
                  field.onChange(value)
                  // Categories and the payer column differ per direction.
                  form.setValue('category', '')
                  form.setValue('status', 'pending')
                }}
              />
            )}
          />
          <Controller
            control={form.control}
            name="category"
            render={({ field, fieldState }) => (
              <Select
                {...field}
                data={categoryOptions}
                error={fieldErrorMessage(fieldState.error)}
                label={t('finances.form.category')}
                onChange={(value) => {
                  field.onChange(value ?? '')
                  form.setValue('status', 'pending')
                }}
              />
            )}
          />
          <Controller
            control={form.control}
            name="amount_minor"
            render={({ field, fieldState }) => (
              <MoneyInput
                error={fieldErrorMessage(fieldState.error)}
                label={t('finances.form.amount')}
                name={field.name}
                value={field.value}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={form.control}
            name="concept"
            render={({ field, fieldState }) => (
              <TextInput
                {...field}
                error={fieldErrorMessage(fieldState.error)}
                label={t('finances.form.concept')}
                placeholder={t(
                  direction === 'expense' ? 'finances.form.conceptExpenseHint' : 'finances.form.conceptIncomeHint',
                )}
              />
            )}
          />
          <Controller
            control={form.control}
            name="detail"
            render={({ field, fieldState }) => (
              <TextInput
                {...field}
                error={fieldErrorMessage(fieldState.error)}
                label={t('finances.form.detail')}
                placeholder={t('finances.form.detailHint')}
              />
            )}
          />
          {direction === 'expense' ? (
            <Controller
              control={form.control}
              name="counterparty"
              render={({ field, fieldState }) => (
                <TextInput
                  {...field}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('finances.form.counterparty')}
                  placeholder={t('finances.form.counterpartyHint')}
                />
              )}
            />
          ) : (
            <Controller
              control={form.control}
              name="unit_id"
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  clearable
                  data={unitOptions}
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('finances.form.unit')}
                  searchable
                  onChange={(value) => field.onChange(value ?? '')}
                />
              )}
            />
          )}
          <DrawerRow>
            <Controller
              control={form.control}
              name="occurred_on"
              render={({ field, fieldState }) => (
                <DateField
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('finances.form.occurredOn')}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={form.control}
              name="due_on"
              render={({ field, fieldState }) => (
                <DateField
                  clearable
                  error={fieldErrorMessage(fieldState.error)}
                  label={t('finances.form.dueOn')}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                />
              )}
            />
          </DrawerRow>
          <Controller
            control={form.control}
            name="status"
            render={({ field, fieldState }) => (
              <Select
                {...field}
                allowDeselect={false}
                data={statusOptions}
                error={fieldErrorMessage(fieldState.error)}
                label={t('finances.form.status')}
                onChange={(value) => field.onChange(value ?? 'pending')}
              />
            )}
          />
          <Controller
            control={form.control}
            name="note"
            render={({ field, fieldState }) => (
              <Textarea
                {...field}
                error={fieldErrorMessage(fieldState.error)}
                label={t('finances.form.note')}
              />
            )}
          />
        </AppDrawerBody>
        <AppDrawerFooter>
          <Button variant="default" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button color="accent" loading={mutation.isPending} type="submit">
            {t('finances.form.submit')}
          </Button>
        </AppDrawerFooter>
      </form>
    </AppDrawer>
  )
}
