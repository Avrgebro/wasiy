import { apiRequest } from '../../app/api-client'
import type { PackageSummary } from '../packages/api'
import type { ReservationSummary } from '../reservations/api'
import type { VisitSummary } from '../visits/api'

export type DashboardActivityEntry = {
  id: string
  event_type: string
  summary: string
  actor_name: string | null
  created_at: string | null
}

/** The operational strip every staff member sees (mockups 17/17b). */
export type DashboardToday = {
  date: string
  visitors_inside_count: number
  visitors_overdue_count: number
  visitors_inside: (VisitSummary & { is_overdue: boolean })[]
  exits_today_count: number
  packages_pending_count: number
  packages_oldest_received_at: string | null
  packages_pending: PackageSummary[]
  reservations_today_count: number
  reservations_with_deposit_count: number
  reservations_today: ReservationSummary[]
  pending_movements_count: number
}

/** Present only for callers who can manage the registry; the API omits it otherwise. */
export type DashboardManagement = {
  month: string
  dues_issued_total_minor: number
  dues_collected_total_minor: number
  units_with_balance_count: number
  deposits_held_total_minor: number
  deposits_held_count: number
  residents_not_invited_count: number
  units_total: number
  units_occupied: number
  units_vacant: number
  units_without_primary_contact: number
  activity: DashboardActivityEntry[]
}

export type LocationDashboardResponse = {
  location: {
    id: string
    account_id: string
    name: string
    slug: string
    timezone: string
  }
  today: DashboardToday
  management?: DashboardManagement
}

export function getLocationDashboard(locationId: string) {
  return apiRequest<LocationDashboardResponse>(`/api/locations/${locationId}/dashboard`)
}
