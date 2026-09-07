import { Alert, Button } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { formatDate } from '../../lib/dates'
import { getSubscription, isAccountAdmin } from '../auth/access'
import { useMe } from '../auth/hooks'
import { shouldShowBanner } from './format'
import { SUBSCRIPTION_ROUTE } from './subscription-guard'

/**
 * Sits under the topbar on every staff page: a countdown through the last
 * week of the trial, then the lapse notice. Admins get the link to act; other
 * staff are told who can (ADR 0039).
 */
export function SubscriptionBanner() {
  const { t } = useTranslation('common')
  const me = useMe().data
  const subscription = me ? getSubscription(me) : null

  if (!me || !subscription || !shouldShowBanner(subscription)) {
    return null
  }

  const admin = isAccountAdmin(me)
  const lapsed = subscription.is_lapsed
  const date = formatDate(subscription.access_until)
  const title = lapsed ? t('subscription.bannerLapsedTitle', { date }) : t('subscription.bannerTrialTitle', { date })
  const body = lapsed
    ? t(admin ? 'subscription.bannerLapsedBody' : 'subscription.bannerLapsedBodyStaff')
    : t('subscription.bannerTrialBody', { count: subscription.days_left })

  return (
    <div className="px-4 pt-2 lg:px-8">
      <Alert color={lapsed ? 'error' : 'warning'} title={title} variant="light">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{body}</span>
          {admin && (
            <Button component={Link} to={SUBSCRIPTION_ROUTE} variant="default" size="xs" radius={8}>
              {t('subscription.bannerAction')}
            </Button>
          )}
        </div>
      </Alert>
    </div>
  )
}
