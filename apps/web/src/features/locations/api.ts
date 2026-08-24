import { apiRequest } from '../../app/api-client'
import { buildParams } from '../../lib/query-params'
import type { PaginatedApiResponse } from '../registry/types'

export type LocationTypeValue =
  | 'multifamily_building'
  | 'condominium'
  | 'residential_community'
  | 'other'

export type LocationPhoto = {
  id: string
  url: string
  original_filename: string
  mime_type: string
  size_bytes: number
  sort_order: number
  is_cover: boolean
}

export type LocationSummary = {
  id: string
  account_id: string
  name: string
  slug: string
  type: LocationTypeValue
  timezone: string
  address_line1: string | null
  address_line2: string | null
  district: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string
  formatted_address: string | null
  phone: string | null
  contact_email: string | null
  access_notes: string | null
  status: 'active' | 'deactivated'
  deactivated_at: string | null
  deactivated_by: { id: string; name: string } | null
  photos?: LocationPhoto[]
  cover_photo_url?: string | null
  units_count: number
  residents_count: number
  vehicles_count: number
  staff_count: number
  unclaimed_invitations_count: number
  active_amenities_count: number
}

export type LocationListResponse = PaginatedApiResponse<LocationSummary>

export type LocationsSearch = {
  page?: number
  per_page?: number
  search?: string
  status?: string
  type?: string
}

export type LocationPayload = {
  name: string
  type: LocationTypeValue
  timezone?: string
  address_line1: string
  address_line2: string | null
  district: string | null
  city: string
  state: string | null
  postal_code: string | null
  country?: string
  phone: string | null
  contact_email: string | null
  access_notes: string | null
}

export function getLocations(accountId: string, search: LocationsSearch) {
  const params = buildParams(search)

  return apiRequest<LocationListResponse>(
    `/api/accounts/${accountId}/locations?${params.toString()}`,
  )
}

export function createLocation(accountId: string, payload: LocationPayload) {
  return apiRequest<{ data: LocationSummary }>(`/api/accounts/${accountId}/locations`, {
    data: payload,
    method: 'POST',
  })
}

export function updateLocation(accountId: string, locationId: string, payload: Partial<LocationPayload>) {
  return apiRequest<{ data: LocationSummary }>(
    `/api/accounts/${accountId}/locations/${locationId}`,
    { data: payload, method: 'PATCH' },
  )
}

export function deactivateLocation(accountId: string, locationId: string) {
  return apiRequest<{ data: LocationSummary }>(
    `/api/accounts/${accountId}/locations/${locationId}/deactivate`,
    { method: 'POST' },
  )
}

export function reactivateLocation(accountId: string, locationId: string) {
  return apiRequest<{ data: LocationSummary }>(
    `/api/accounts/${accountId}/locations/${locationId}/reactivate`,
    { method: 'POST' },
  )
}
