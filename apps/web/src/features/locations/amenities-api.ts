import { apiRequest } from '../../app/api-client'
import type { LocationPhoto } from './api'

export type BookingModeValue = 'instant' | 'approval'

export type AvailabilityWindow = { start: string; end: string }

export type Availability = Partial<Record<string, AvailabilityWindow[]>>

export type BookingPolicySource = 'amenity' | 'location'

export type AmenitySummary = {
  id: string
  account_id: string
  location_id: string
  name: string
  slug: string
  description: string | null
  is_reservable: boolean
  capacity: number | null
  booking_mode: BookingModeValue
  availability: Availability
  max_duration_minutes: number | null
  min_duration_minutes: number | null
  buffer_minutes: number | null
  max_advance_days: number | null
  max_concurrent_per_unit: number | null
  cancellation_window_hours: number | null
  effective_booking_policy: Record<string, { value: number; source: BookingPolicySource }> | null
  fee_amount: number | null
  deposit_amount: number | null
  status: 'active' | 'deactivated'
  deactivated_at: string | null
  photos?: LocationPhoto[]
  cover_photo_url?: string | null
}

export type AmenityPayload = {
  name?: string
  description?: string | null
  is_reservable?: boolean
  capacity?: number | null
  booking_mode?: BookingModeValue
  availability?: Availability | null
  max_duration_minutes?: number | null
  max_advance_days?: number | null
  max_concurrent_per_unit?: number | null
  cancellation_window_hours?: number | null
  fee_amount?: number | null
  deposit_amount?: number | null
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
