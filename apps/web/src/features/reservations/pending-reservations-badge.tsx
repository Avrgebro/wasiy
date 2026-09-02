import { useQuery } from '@tanstack/react-query'
import { useMe } from '../auth/hooks'
import { getReservations } from './api'
import { localDateString } from './week'

/**
 * The amber counter next to Reservas in the sidebar. Shares the reservations
 * page's queue query key, so navigating there reuses the cached result and
 * approvals refresh the badge through the same invalidation.
 */
export function PendingReservationsBadge() {
  const me = useMe().data
  const account = me?.active_account
  const location = me?.active_location
  const today = location ? localDateString(new Date(), location.timezone) : ''

  const query = useQuery({
    enabled: Boolean(account && location),
    queryKey: ['reservations', 'queue', account?.id, location?.id, today],
    queryFn: () => getReservations(account!.id, location!.id, { from: today }),
    staleTime: 60_000,
  })

  const count = (query.data?.data ?? []).filter(
    (reservation) => reservation.status === 'pending' || reservation.status === 'observed',
  ).length

  if (count === 0) {
    return null
  }

  return (
    <span className="ml-auto shrink-0 rounded-full bg-[var(--wa-accent)] px-2 py-0.5 text-[11px] font-semibold leading-4 text-[#1c2b2c]">
      {count}
    </span>
  )
}
