import { apiRequest } from '../../app/api-client'

/** A tower inside a location (ADR 0037). `name` is null only while the location has a single building. */
export type BuildingSummary = {
  id: string
  location_id: string
  name: string | null
  sort_order: number
  units_count: number
}

export type BuildingPayload = { name: string | null; sort_order?: number }

export function buildingsQueryKey(locationId: string) {
  return ['locations', locationId, 'buildings'] as const
}

export function getBuildings(locationId: string) {
  return apiRequest<{ data: BuildingSummary[] }>(`/api/locations/${locationId}/buildings`)
}

export function createBuilding(locationId: string, payload: BuildingPayload) {
  return apiRequest<{ data: BuildingSummary }>(`/api/locations/${locationId}/buildings`, { method: 'POST', data: payload })
}

export function updateBuilding(buildingId: string, payload: Partial<BuildingPayload>) {
  return apiRequest<{ data: BuildingSummary }>(`/api/buildings/${buildingId}`, { method: 'PATCH', data: payload })
}

export function deleteBuilding(buildingId: string) {
  return apiRequest<{ data: { id: string } }>(`/api/buildings/${buildingId}`, { method: 'DELETE' })
}
