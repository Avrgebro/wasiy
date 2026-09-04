import { apiRequest } from '../../app/api-client'
import { buildParams } from '../../lib/query-params'
import type { PaginatedApiResponse } from '../registry/types'

export type PackageStatus = 'pending' | 'delivered'

export type PackageSummary = {
  id: string
  account_id: string
  location_id: string
  unit_id: string
  unit_number?: string
  building_name?: string | null
  resident_id: string | null
  resident_name?: string | null
  notes: string | null
  status: PackageStatus
  received_at: string
  received_by_name?: string | null
  delivered_at: string | null
  delivered_by_name?: string | null
  delivered_to: string | null
  notified_email: string | null
}

export type PackagesSearch = { status?: string; search?: string; page?: number; per_page?: number }

export function getPackages(locationId: string, search: PackagesSearch) {
  const params = buildParams(search)

  return apiRequest<PaginatedApiResponse<PackageSummary>>(`/api/locations/${locationId}/packages?${params.toString()}`)
}

export function registerPackage(
  locationId: string,
  payload: { unit_id: string; resident_id: string | null; notes: string | null },
) {
  return apiRequest<{ data: PackageSummary }>(`/api/locations/${locationId}/packages`, { method: 'POST', data: payload })
}

export function deliverPackage(packageId: string, deliveredTo: string | null) {
  return apiRequest<{ data: PackageSummary }>(`/api/packages/${packageId}/deliver`, {
    method: 'POST',
    data: { delivered_to: deliveredTo },
  })
}
