import { apiRequest } from '../../app/api-client'
import type { LocationPhoto } from './api'

export type BookingModeValue = 'instant' | 'approval'

export type AmenitySummary = {
  id: string
  account_id: string
  location_id: string
  name: string
  slug: string
  description: string | null
  is_reservable: boolean
  booking_mode: BookingModeValue
  /** Weekday keys (`monday`…`sunday`) the amenity can be booked on (ADR 0043). */
  open_days: string[]
  /** Approved bookings allowed per day; null means no limit. */
  daily_capacity: number | null
  fee_amount_minor: number | null
  deposit_amount_minor: number | null
  status: 'active' | 'deactivated'
  deactivated_at: string | null
  photos?: LocationPhoto[]
  cover_photo_url?: string | null
}

export type AmenityPayload = {
  name?: string
  description?: string | null
  is_reservable?: boolean
  booking_mode?: BookingModeValue
  open_days?: string[]
  daily_capacity?: number | null
  fee_amount_minor?: number | null
  deposit_amount_minor?: number | null
}

function amenitiesBase(accountId: string, locationId: string) {
  return `/api/accounts/${accountId}/locations/${locationId}/amenities`
}

export function getAmenities(accountId: string, locationId: string) {
  return apiRequest<{ data: AmenitySummary[] }>(amenitiesBase(accountId, locationId))
}

export function createAmenity(accountId: string, locationId: string, payload: AmenityPayload) {
  return apiRequest<{ data: AmenitySummary }>(amenitiesBase(accountId, locationId), {
    data: payload,
    method: 'POST',
  })
}

export function updateAmenity(
  accountId: string,
  locationId: string,
  amenityId: string,
  payload: AmenityPayload,
) {
  return apiRequest<{ data: AmenitySummary }>(
    `${amenitiesBase(accountId, locationId)}/${amenityId}`,
    { data: payload, method: 'PATCH' },
  )
}

export function deactivateAmenity(accountId: string, locationId: string, amenityId: string) {
  return apiRequest<{ data: AmenitySummary; meta: { future_reservations: number } }>(
    `${amenitiesBase(accountId, locationId)}/${amenityId}/deactivate`,
    { method: 'POST' },
  )
}

export function reactivateAmenity(accountId: string, locationId: string, amenityId: string) {
  return apiRequest<{ data: AmenitySummary }>(
    `${amenitiesBase(accountId, locationId)}/${amenityId}/reactivate`,
    { method: 'POST' },
  )
}

export function uploadAmenityPhoto(
  accountId: string,
  locationId: string,
  amenityId: string,
  file: File,
) {
  const data = new FormData()
  data.append('file', file)

  return apiRequest<{ data: LocationPhoto }>(
    `${amenitiesBase(accountId, locationId)}/${amenityId}/photos`,
    { data, method: 'POST' },
  )
}

export function deleteAmenityPhoto(
  accountId: string,
  locationId: string,
  amenityId: string,
  photoId: string,
) {
  return apiRequest<void>(
    `${amenitiesBase(accountId, locationId)}/${amenityId}/photos/${photoId}`,
    { method: 'DELETE' },
  )
}

export function setAmenityCoverPhoto(
  accountId: string,
  locationId: string,
  amenityId: string,
  photoId: string,
) {
  return apiRequest<{ data: LocationPhoto }>(
    `${amenitiesBase(accountId, locationId)}/${amenityId}/photos/${photoId}/cover`,
    { method: 'POST' },
  )
}

/** One day as the server reports it; `reason` explains an unavailable one. */
export type AvailabilityDay = {
  date: string
  available: boolean
  reason: 'closed' | 'past' | 'full' | null
  approved_count: number
}

export type AvailabilityResponse = {
  days: AvailabilityDay[]
  daily_capacity: number | null
  booking_mode: BookingModeValue
  fee_amount_minor: number | null
  deposit_amount_minor: number | null
}

/** Day availability over a range (capped at 90 days by the API); staff reads it like the portal does (ADR 0043). */
export function getAmenityAvailability(amenityId: string, from: string, to: string) {
  const params = new URLSearchParams({ from, to })

  return apiRequest<AvailabilityResponse>(`/api/amenities/${amenityId}/availability?${params.toString()}`)
}
