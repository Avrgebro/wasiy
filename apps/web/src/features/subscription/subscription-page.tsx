import { Alert, Anchor, Text } from '@mantine/core'
import { Trans, useTranslation } from 'react-i18next'
import { StatCard } from '../../components/ui/stat-card'
import { formatDate } from '../../lib/dates'
import { getSubscription, isAccountAdmin } from '../auth/access'
import { useMe } from '../auth/hooks'
import { formatPlanMoney, monthlyTotalMinor } from './format'

/**
 * /admin/subscription: the plan, what it costs and where the trial stands.
 * Payment is manual (transfer, Yape, Plin), so the action is a mailto to the
 * sales inbox the API hands us. Open to every staff role because a lapsed
 * account lands everyone here (ADR 0039).
 */
export function SubscriptionPage() {
  const { t } = useTranslation('common')
  const me = useMe().data
  const account = me?.active_account
  const subscription = me ? getSubscription(me) : null

  if (!me || !account) {
    return (
      <Alert color="warning" title={t('auth.noAccessTitle')}>
        {t('accountSelection.title')}
      </Alert>
    )
  }

  return (
    <div className="@container flex flex-col gap-6">
      <div className="min-w-0">
        <h1 className="m-0 text-2xl font-bold text-[var(--mantine-color-text)]">{t('subscription.title')}</h1>
        <Text c="dimmed" mt={6} size="sm">
          {t('subscription.subtitle', { account: account.name })}
        </Text>
      </div>

      {!subscription ? (
        <Text c="dimmed">{t('subscription.none')}</Text>
      ) : (
        <>
          {subscription.is_lapsed && (
            <Alert color="error" title={t('subscription.lockedTitle')} variant="light">
              {t('subscription.lockedBody')}
            </Alert>
          )}
          <div className="grid gap-4 @lg:grid-cols-2 @3xl:grid-cols-4">
            <StatCard
              label={t('subscription.plan')}
              value={subscription.plan.name}
              detail={t('subscription.planDetail', { price: formatPlanMoney(subscription.unit_price_minor, subscription.currency) })}
            />
            <StatCard
              label={t('subscription.billableUnits')}
              value={String(subscription.billable_units)}
              detail={t('subscription.billableUnitsDetail')}
            />
            <StatCard
              label={t('subscription.monthlyTotal')}
              value={formatPlanMoney(monthlyTotalMinor(subscription), subscription.currency)}
              detail={t('subscription.monthlyTotalDetail')}
            />
            <StatCard
              label={t('subscription.status')}
              value={t(`subscription.status_${subscription.status}`)}
              tone={subscription.is_lapsed ? 'error' : subscription.status === 'active' ? 'success' : undefined}
              highlighted={subscription.is_lapsed}
              detail={
                subscription.is_lapsed
                  ? t('subscription.lapsedOn', { date: formatDate(subscription.access_until) })
                  : subscription.status === 'trialing'
                    ? t('subscription.trialEndsOn', { date: formatDate(subscription.trial_ends_at) })
                    : t('subscription.accessUntil', { date: formatDate(subscription.access_until) })
              }
            />
          </div>
          {isAccountAdmin(me) && (
            <Alert color="info" title={t('subscription.howToPayTitle')} variant="light">
              <Trans
                components={{ mail: <Anchor href={`mailto:${subscription.contact_email}`} /> }}
                i18nKey="subscription.howToPayBody"
                ns="common"
                values={{ email: subscription.contact_email }}
              />
            </Alert>
          )}
        </>
      )}
    </div>
  )
}
