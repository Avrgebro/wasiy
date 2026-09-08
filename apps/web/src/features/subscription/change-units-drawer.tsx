import { Button, NumberInput, Text } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { ApiError } from '../../app/api-client'
import { getErrorMessage } from '../../lib/errors'
import { notifySuccess } from '../../lib/notify'
import { subscriptionPageQueryKey, updateContractedUnits, type SubscriptionPageData } from './api'
import { formatLongDay, formatPlanMoney } from './format'

/**
 * "Ampliar unidades" (ADR 0040). One number: the contracted units. The
 * drawer shows the monthly total it means and when it applies, which
 * depends on the direction: up is immediate, down waits for the renewal.
 */
export function ChangeUnitsDrawer({ data, opened, onClose }: { data: SubscriptionPageData; opened: boolean; onClose: () => void }) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const { subscription, plan } = data
  const [units, setUnits] = useState<number | string>(subscription.billable_units)
  const [error, setError] = useState('')
  const value = typeof units === 'number' ? units : subscription.billable_units
  const total = Math.max(value, plan.included_units) * plan.unit_price_minor
  const direction = value > subscription.billable_units ? 'up' : value < subscription.billable_units ? 'down' : 'same'

  // Stays mounted like every drawer so Mantine can animate it; state resets on close.
  function close() {
    setUnits(subscription.billable_units)
    setError('')
    onClose()
  }

  const mutation = useMutation({
    mutationFn: updateContractedUnits,
    onSuccess: ({ data: next }) => {
      queryClient.setQueryData(subscriptionPageQueryKey, { data: next })
      notifySuccess(t('subscription.units.saved'))
      setUnits(next.subscription.billable_units)
      setError('')
      onClose()
    },
    onError: (err) => setError(err instanceof ApiError && err.errors?.units ? err.errors.units.join(' ') : getErrorMessage(err)),
    meta: { suppressErrorNotification: true },
  })

  const note = direction === 'up'
    ? t('subscription.units.up')
    : direction === 'down'
      ? t('subscription.units.down', { date: formatLongDay(subscription.access_until) })
      : subscription.pending_billable_units !== null
        ? t('subscription.units.cancelPending', { count: subscription.pending_billable_units })
        : t('subscription.units.same')

  return (
    <AppDrawer onClose={close} opened={opened} subtitle={t('subscription.units.subtitle')} title={t('subscription.units.title')} width={480}>
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={(event) => { event.preventDefault(); setError(''); mutation.mutate(value) }}>
        <AppDrawerBody>
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            description={t('subscription.units.floor', { count: plan.included_units })}
            label={t('subscription.units.label')}
            max={10000}
            min={plan.included_units}
            onChange={setUnits}
            step={1}
            value={units}
            w={200}
          />
          <Text c="dimmed" size="sm">{t('subscription.units.inUse', { count: subscription.units_in_use })}</Text>
          <div className="rounded-inner bg-[var(--wa-surface-2)] px-4 py-3">
            <p className="m-0 text-xs text-[var(--mantine-color-dimmed)]">{t('subscription.units.total', { count: Math.max(value, plan.included_units) })}</p>
            <p className="m-0 font-display text-2xl font-bold text-[var(--mantine-color-text)]">{formatPlanMoney(total, plan.currency)}</p>
            <p className="m-0 mt-1 text-sm text-[var(--mantine-color-dimmed)]">{note}</p>
          </div>
          {error ? <p className="m-0 text-sm text-[var(--wa-error)]" role="alert">{error}</p> : null}
        </AppDrawerBody>
        <AppDrawerFooter>
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Button className="w-full sm:w-auto" color="accent" disabled={direction === 'same' && subscription.pending_billable_units === null} loading={mutation.isPending} type="submit">{t('subscription.units.submit')}</Button>
            <Button className="w-full sm:w-auto" onClick={close} variant="default">{t('actions.cancel')}</Button>
          </div>
        </AppDrawerFooter>
      </form>
    </AppDrawer>
  )
}
