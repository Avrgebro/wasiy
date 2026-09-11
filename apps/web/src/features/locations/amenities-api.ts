import { apiRequest } from '../../app/api-client'
import type { LocationPhoto } from './api'

export type BookingModeValue = 'instant' | 'approval'

export type AvailabilityWindow = { start: string; end: string }

export type Availability = Partial<Record<string, AvailabilityWindow[]>>

export type AmenitySummary = {
  id: string
  account_id: string
  location_id: string
  name: string
  slug: string
  description: string | null
  is_reservable: boolean
  booking_mode: BookingModeValue
  availability: Availability
  /** Length of one bookable slot (ADR 0041); a booking covers consecutive slots. */
  slot_minutes: number
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
  booking_mode?: BookingModeValue
  availability?: Availability | null
  slot_minutes?: number
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

/** One bookable slot as the server offers it; `reason` explains an unavailable one. */
export type AvailabilitySlot = { start: string; end: string; available: boolean; reason: 'past' | 'taken' | null }

export type AvailabilityResponse = {
  date: string
  slot_minutes: number
  booking_mode: BookingModeValue
  fee_amount: number | null
  deposit_amount: number | null
  slots: AvailabilitySlot[]
}

/** The staff surface reads slots from the server like the portal does (ADR 0041). */
export function getAmenityAvailability(amenityId: string, date: string, unitId?: string) {
  const params = new URLSearchParams({ date })
  if (unitId) params.set('unit_id', unitId)

  return apiRequest<AvailabilityResponse>(`/api/amenities/${amenityId}/availability?${params.toString()}`)
}
