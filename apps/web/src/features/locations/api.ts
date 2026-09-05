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

export function getLocation(accountId: string, locationId: string) {
  return apiRequest<{ data: LocationSummary }>(
    `/api/accounts/${accountId}/locations/${locationId}`,
  )
}

export function uploadLocationPhoto(accountId: string, locationId: string, file: File) {
  const data = new FormData()
  data.append('file', file)

  return apiRequest<{ data: LocationPhoto }>(
    `/api/accounts/${accountId}/locations/${locationId}/photos`,
    { data, method: 'POST' },
  )
}

export function deleteLocationPhoto(accountId: string, locationId: string, photoId: string) {
  return apiRequest<void>(
    `/api/accounts/${accountId}/locations/${locationId}/photos/${photoId}`,
    { method: 'DELETE' },
  )
}

export function setLocationCoverPhoto(accountId: string, locationId: string, photoId: string) {
  return apiRequest<{ data: LocationPhoto }>(
    `/api/accounts/${accountId}/locations/${locationId}/photos/${photoId}/cover`,
    { method: 'POST' },
  )
}

export function reorderLocationPhotos(accountId: string, locationId: string, photoIds: string[]) {
  return apiRequest<{ data: LocationPhoto[] }>(
    `/api/accounts/${accountId}/locations/${locationId}/photos/order`,
    { data: { photo_ids: photoIds }, method: 'PUT' },
  )
}


export type OperationalSettingsValues = {
  visitor_preregistration_enabled: boolean
  visitor_auto_checkout_hours: number
  reservation_max_advance_days: number
  reservation_max_concurrent_per_unit: number
  reservation_cancellation_window_hours: number
  quiet_hours_enabled: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  announcements_location_manager_can_post: boolean
  announcements_email_residents: boolean
}

export type SettingsSource = 'location' | 'account' | 'default'

export type SettingsExplanation = {
  [K in keyof OperationalSettingsValues]: {
    value: OperationalSettingsValues[K]
    source: SettingsSource
    account_value?: OperationalSettingsValues[K]
  }
}

export type SettingsResponse = {
  data: {
    values: OperationalSettingsValues
    explanation: SettingsExplanation
  }
}

/**
 * Merge-write contract: a key present with a value becomes this level's
 * override, null clears the override back to inherited, absent keys are
 * untouched — so per-group saves never clobber each other.
 */
export type SettingsPayload = {
  [K in keyof OperationalSettingsValues]?: OperationalSettingsValues[K] | null
}

export function getLocationSettings(accountId: string, locationId: string) {
  return apiRequest<SettingsResponse>(
    `/api/accounts/${accountId}/locations/${locationId}/settings`,
  )
}

export function updateLocationSettings(accountId: string, locationId: string, payload: SettingsPayload) {
  return apiRequest<SettingsResponse>(
    `/api/accounts/${accountId}/locations/${locationId}/settings`,
    { data: payload, method: 'PUT' },
  )
}

export function getAccountSettings(accountId: string) {
  return apiRequest<SettingsResponse>(`/api/accounts/${accountId}/settings`)
}

export function updateAccountSettings(accountId: string, payload: SettingsPayload) {
  return apiRequest<SettingsResponse>(`/api/accounts/${accountId}/settings`, {
    data: payload,
    method: 'PUT',
  })
}
