import { apiRequest } from '../../app/api-client'

export type LocationDashboardResponse = {
  location: {
    id: string
    account_id: string
    name: string
    slug: string
    timezone: string
  }
  metrics: {
    assigned_staff_count: number
  }
}

export function getLocationDashboard(locationId: string) {
  return apiRequest<LocationDashboardResponse>(
    `/api/locations/${locationId}/dashboard`,
  )
}
