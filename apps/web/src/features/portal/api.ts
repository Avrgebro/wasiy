import { apiRequest } from '../../app/api-client'
import { buildParams } from '../../lib/query-params'
import type { ResidentMembership } from '../auth/types'
import type { PaginatedApiResponse } from '../../lib/pagination'

export type PortalResident = {
  id: string
  account_id: string
  user_id: string
  first_name: string
  last_name: string
  name: string
  phone: string | null
  email: string | null
  status: 'active' | 'inactive'
  memberships: ResidentMembership[]
  /** Only present for the person themself. */
  email_alerts?: EmailAlertPreferences
  login_email?: string
}

type PortalResidentResponse = {
  data: PortalResident
}

/** The four switches under "Notificaciones por correo" (mockup 03c). */
export const ALERT_FAMILIES = ['reservations', 'packages', 'visitors', 'announcements'] as const
export type AlertFamily = (typeof ALERT_FAMILIES)[number]
export type EmailAlertPreferences = Record<AlertFamily, boolean>

export async function getPortalResident() {
  const response = await apiRequest<PortalResidentResponse>('/api/portal/resident')

  return response.data
}

export async function updatePortalEmailAlerts(preferences: EmailAlertPreferences) {
  const response = await apiRequest<PortalResidentResponse>('/api/portal/resident/email-alerts', { data: preferences, method: 'PATCH' })

  return response.data
}

/** An alert row (mockup 03b): what happened, for which unit, and whether I opened it. */
export type PortalAlert = {
  id: string
  unit_id: string
  kind: 'reservation.approved' | 'reservation.observed' | 'reservation.rejected' | 'package.received' | 'package.delivered' | 'visit.arrived' | 'announcement.published'
  family: AlertFamily
  title: string
  body: string | null
  subject_type: 'reservation' | 'package' | 'visit' | null
  subject_id: string | null
  read_at: string | null
  created_at: string
}

export function getPortalAlerts(unitId: string, scope: 'new' | 'all') {
  const params = buildParams({ unit_id: unitId, scope, per_page: 50 })

  return apiRequest<PaginatedApiResponse<PortalAlert>>(`/api/portal/alerts?${params.toString()}`)
}

export function getPortalUnreadCount(unitId: string) {
  return apiRequest<{ unread: number }>(`/api/portal/alerts/unread-count?unit_id=${unitId}`)
}

export function markPortalAlertRead(alertId: string) {
  return apiRequest<{ data: PortalAlert }>(`/api/portal/alerts/${alertId}/read`, { method: 'POST' })
}

export function markAllPortalAlertsRead(unitId: string) {
  return apiRequest<{ marked: number }>('/api/portal/alerts/read-all', { method: 'POST', data: { unit_id: unitId } })
}

export async function updatePortalResidentPhone(phone: string | null) {
  const response = await apiRequest<PortalResidentResponse>(
    '/api/portal/resident/phone',
    {
      data: { phone },
      method: 'PATCH',
    },
  )

  return response.data
}

/** A visit as the resident sees it: their own announcements and what happened at the door. */
export type PortalVisitStatus = 'expected' | 'inside' | 'left' | 'cancelled'

export type PortalVisit = {
  id: string
  unit_id: string
  unit_number?: string
  building_name?: string | null
  visitor_name: string
  document: string | null
  notes: string | null
  status: PortalVisitStatus
  expected_on: string | null
  expected_time: string | null
  pre_registered_by_name?: string | null
  pre_registered_at: string | null
  checked_in_at: string | null
  checked_in_by_name?: string | null
  checked_out_at: string | null
  auto_checked_out: boolean
  cancelled_at: string | null
}

export type PortalVisitScope = 'expected' | 'today' | 'history'

export function getPortalVisits(unitId: string, scope: PortalVisitScope, page = 1) {
  const params = buildParams({ unit_id: unitId, scope, page })

  return apiRequest<PaginatedApiResponse<PortalVisit>>(`/api/portal/visits?${params.toString()}`)
}

export type PreRegisterVisitPayload = {
  unit_id: string
  visitor_name: string
  document: string | null
  expected_on: string
  expected_time: string | null
  notes: string | null
}

export function preRegisterVisit(payload: PreRegisterVisitPayload) {
  return apiRequest<{ data: PortalVisit }>('/api/portal/visits', { method: 'POST', data: payload })
}

export function cancelPortalVisit(visitId: string) {
  return apiRequest<{ data: PortalVisit }>(`/api/portal/visits/${visitId}/cancel`, { method: 'POST' })
}

export type PortalPackage = {
  id: string
  unit_id: string
  resident_name?: string | null
  notes: string | null
  status: 'pending' | 'delivered'
  received_at: string
  delivered_at: string | null
}

export function getPortalPackages(unitId: string, status?: 'pending' | 'delivered') {
  const params = buildParams({ unit_id: unitId, status })

  return apiRequest<PaginatedApiResponse<PortalPackage>>(`/api/portal/packages?${params.toString()}`)
}

/** Amenities as the resident sees them (P2): what can be booked and on which terms. */
export type PortalAmenity = {
  id: string
  name: string
  description: string | null
  booking_mode: 'instant' | 'approval'
  slot_minutes: number
  fee_amount: number | null
  deposit_amount: number | null
  photos: { id: string; url: string; is_cover: boolean }[]
  cover_photo_url: string | null
}

export function getPortalAmenities(unitId: string) {
  return apiRequest<{ data: PortalAmenity[] }>(`/api/portal/amenities?${buildParams({ unit_id: unitId }).toString()}`)
}

export type AvailabilitySlot = { start: string; end: string; available: boolean; reason: 'past' | null }

export type AvailabilityResponse = {
  date: string
  slot_minutes: number
  booking_mode: 'instant' | 'approval'
  fee_amount: number | null
  deposit_amount: number | null
  slots: AvailabilitySlot[]
}

export function getAvailability(amenityId: string, unitId: string, date: string) {
  return apiRequest<AvailabilityResponse>(`/api/portal/amenities/${amenityId}/availability?${buildParams({ unit_id: unitId, date }).toString()}`)
}

export type PortalReservationStatus = 'pending' | 'approved' | 'observed' | 'rejected' | 'cancelled'

export type PortalReservation = {
  id: string
  amenity_id: string
  amenity_name?: string
  unit_id: string
  unit_number?: string
  resident_name?: string | null
  starts_at: string
  ends_at: string
  status: PortalReservationStatus
  is_completed: boolean
  status_note: string | null
  fee_snapshot: number | null
  deposit_snapshot: number | null
  created_by_name?: string | null
  decided_by_name?: string | null
  decided_at: string | null
  created_at: string | null
}

export type PortalReservationHistory = { id: string; event_type: string; status: string | null; note: string | null; actor_name: string | null; created_at: string | null }

export function getPortalReservations(unitId: string, scope: 'upcoming' | 'past', page = 1) {
  return apiRequest<PaginatedApiResponse<PortalReservation>>(`/api/portal/reservations?${buildParams({ unit_id: unitId, scope, page }).toString()}`)
}

export function getPortalReservation(reservationId: string) {
  return apiRequest<{ data: PortalReservation; history: PortalReservationHistory[]; can_cancel: boolean }>(`/api/portal/reservations/${reservationId}`)
}

export function requestReservation(payload: { unit_id: string; amenity_id: string; date: string; start: string; end: string }) {
  return apiRequest<{ data: PortalReservation }>('/api/portal/reservations', { method: 'POST', data: payload })
}

export function cancelPortalReservation(reservationId: string) {
  return apiRequest<{ data: PortalReservation }>(`/api/portal/reservations/${reservationId}/cancel`, { method: 'POST' })
}

/** Mi hogar (Portal 04): the unit's active members as the portal shows them. */
export type HouseholdMember = {
  membership_id: string
  resident_id: string
  first_name: string
  last_name: string
  name: string
  phone: string | null
  resident_type: 'owner' | 'tenant' | 'occupant' | 'guest_resident' | null
  is_primary_contact: boolean
  is_me: boolean
  portal_state: 'active' | 'invited' | 'not_invited'
  status: 'active' | 'inactive'
  started_at: string | null
}

export const PORTAL_RESIDENT_TYPES = ['owner', 'tenant', 'occupant'] as const
export type PortalResidentType = (typeof PORTAL_RESIDENT_TYPES)[number]

export function getPortalHousehold(unitId: string) {
  return apiRequest<{ data: HouseholdMember[]; can_manage: boolean }>(`/api/portal/household?unit_id=${unitId}`)
}

export function addHouseholdMember(payload: { unit_id: string; first_name: string; last_name: string; phone: string | null; email: string | null; resident_type: PortalResidentType }) {
  return apiRequest<{ data: HouseholdMember }>('/api/portal/household', { method: 'POST', data: payload })
}

export function removeHouseholdMember(membershipId: string) {
  return apiRequest<{ data: HouseholdMember }>(`/api/portal/household/${membershipId}`, { method: 'DELETE' })
}

export function resendHouseholdInvitation(membershipId: string) {
  return apiRequest<{ data: HouseholdMember }>(`/api/portal/household/${membershipId}/resend-invitation`, { method: 'POST' })
}

/** Vehículos: the unit's, editable by any member. */
export type PortalVehicle = {
  id: string
  unit_id: string
  vehicle_type: 'car' | 'motorcycle' | 'bicycle' | 'other'
  plate: string | null
  make: string | null
  model: string | null
  color: string | null
  status: 'active' | 'inactive'
}

export type PortalVehiclePayload = { plate: string; make: string | null; model: string | null; color: string | null }

export function getPortalVehicles(unitId: string) {
  return apiRequest<PaginatedApiResponse<PortalVehicle>>(`/api/portal/vehicles?unit_id=${unitId}&per_page=50`)
}

export function createPortalVehicle(unitId: string, payload: PortalVehiclePayload) {
  return apiRequest<{ data: PortalVehicle }>('/api/portal/vehicles', { method: 'POST', data: { unit_id: unitId, vehicle_type: 'car', ...payload } })
}

export function updatePortalVehicle(vehicleId: string, payload: PortalVehiclePayload) {
  return apiRequest<{ data: PortalVehicle }>(`/api/portal/vehicles/${vehicleId}`, { method: 'PATCH', data: payload })
}

export function deletePortalVehicle(vehicleId: string) {
  return apiRequest<void>(`/api/portal/vehicles/${vehicleId}`, { method: 'DELETE' })
}

/** Estado de cuenta (Portal 04f), primary contact only. */
export type LedgerRow = {
  id: string
  concept: string
  detail: string | null
  category: string
  occurred_on: string
  period: string | null
  amount: number
  state: 'pending' | 'paid'
}

export type LedgerResponse = {
  data: LedgerRow[]
  balance: number
  pending_count: number
  last_dues: { period: string | null; amount: number; settled: boolean } | null
}

export function getPortalLedger(unitId: string, scope: 'pending' | 'all' = 'all') {
  return apiRequest<LedgerResponse>(`/api/portal/ledger?unit_id=${unitId}&scope=${scope}`)
}

export function changePassword(payload: { current_password: string; password: string; password_confirmation: string }) {
  return apiRequest<void>('/api/me/password', { method: 'PATCH', data: payload })
}
