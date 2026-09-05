import { apiRequest } from '../../app/api-client'

export type SearchGroupKey = 'units' | 'residents' | 'visits' | 'packages'

export type SearchHit = {
  id: string
  label: string
  description: string | null
  to:
    | { page: 'unit'; unit_id: string }
    | { page: 'resident'; resident_id: string }
    | { page: 'visit'; visit_id: string }
    | { page: 'package'; package_id: string }
}

export type SearchResponse = {
  q: string
  /** Only groups the caller may open and that matched (ADR 0036). */
  groups: { key: SearchGroupKey; items: SearchHit[] }[]
}

export function searchLocation(locationId: string, q: string) {
  return apiRequest<SearchResponse>(`/api/locations/${locationId}/search?q=${encodeURIComponent(q)}`)
}
