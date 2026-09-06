import { apiRequest } from '../../app/api-client'
import { buildParams } from '../../lib/query-params'
import type { PaginatedApiResponse } from '../registry/types'

export type AnnouncementStatus = 'scheduled' | 'active' | 'expired' | 'archived'

export type AnnouncementSummary = {
  id: string
  account_id: string
  location_id: string
  title: string
  /** Markdown subset: bold, italic, lists, links. The editor reads and writes this. */
  body_md: string
  /** Rendered server-side from body_md with raw HTML stripped; safe to inject. */
  body_html: string
  excerpt: string
  is_important: boolean
  status: AnnouncementStatus
  publish_at: string
  published_at: string | null
  expires_on: string | null
  archived_at: string | null
  author_name?: string | null
  notified_count: number
  emailed_count: number
}

export type AnnouncementsSearch = { status?: string; search?: string; page?: number; per_page?: number }

/** publish_at is wall-clock "YYYY-MM-DD HH:mm" in the location's timezone; omitted means now. */
export type AnnouncementPayload = {
  title: string
  body_md: string
  is_important: boolean
  publish_at?: string | null
  expires_on: string | null
}

export function getAnnouncements(locationId: string, search: AnnouncementsSearch) {
  const params = buildParams(search)

  return apiRequest<PaginatedApiResponse<AnnouncementSummary>>(`/api/locations/${locationId}/announcements?${params.toString()}`)
}

export function createAnnouncement(locationId: string, payload: AnnouncementPayload) {
  return apiRequest<{ data: AnnouncementSummary }>(`/api/locations/${locationId}/announcements`, { method: 'POST', data: payload })
}

export function updateAnnouncement(announcementId: string, payload: Partial<AnnouncementPayload>) {
  return apiRequest<{ data: AnnouncementSummary }>(`/api/announcements/${announcementId}`, { method: 'PATCH', data: payload })
}

export function archiveAnnouncement(announcementId: string) {
  return apiRequest<{ data: AnnouncementSummary }>(`/api/announcements/${announcementId}/archive`, { method: 'POST' })
}
