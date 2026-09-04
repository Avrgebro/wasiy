import { apiRequest } from '../../app/api-client'
import { buildParams } from '../../lib/query-params'
import type { PaginatedApiResponse, RegistrySearch } from '../registry/types'
import type { UnitFormValues } from './schemas'

export type UnitType = 'apartment' | 'house' | 'commercial' | 'office'
export type UnitOccupancy = 'occupied' | 'vacant' | 'attention'
export type UnitPortalState = 'active' | 'invited' | 'not_invited' | null

export type UnitSummary = {
  id: string
  account_id: string
  location_id: string
  unit_number: string
  type: UnitType
  building_name: string | null
  floor: string | null
  area_m2: number | null
  participation_share: number | null
  maintenance_fee: number | null
  parking_spots: string[]
  storage_rooms: string[]
  status: 'active' | 'inactive'
  notes: string | null
  resident_count: number
  vehicle_count: number
  occupancy: UnitOccupancy
  portal_state: UnitPortalState
  primary_contact: {
    name: string
    phone: string | null
    email: string | null
    resident_type: string
    resident_id: string
    unit_membership_id: string
  } | null
}

export type UnitsSearch = RegistrySearch & {
  occupancy?: string
  portal?: string
  fee?: string
  type?: string
}

export function getUnits(locationId: string, search: UnitsSearch) {
  const params = buildParams(search)

  return apiRequest<PaginatedApiResponse<UnitSummary>>(
    `/api/locations/${locationId}/units?${params.toString()}`,
  )
}

export function createUnit(locationId: string, values: UnitFormValues) {
  return apiRequest<{ data: UnitSummary }>(`/api/locations/${locationId}/units`, {
    data: values,
    method: 'POST',
  })
}

export function updateUnit(unitId: string, values: UnitFormValues) {
  return apiRequest<{ data: UnitSummary }>(`/api/units/${unitId}`, {
    data: values,
    method: 'PATCH',
  })
}
