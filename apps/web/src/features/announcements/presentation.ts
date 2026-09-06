import type { TFunction } from 'i18next'
import { shortDate, shortDateTime } from '../finances/month'
import type { AnnouncementStatus, AnnouncementSummary } from './api'

export function announcementStatusColor(status: AnnouncementStatus): string {
  return { scheduled: 'info', active: 'success', expired: 'gray', archived: 'gray' }[status]
}

/** The Vigencia column: what the state means in time. */
export function validityLabel(announcement: AnnouncementSummary, timezone: string, t: TFunction): string {
  switch (announcement.status) {
    case 'scheduled':
      return t('announcements.validity.publishes', { date: shortDateTime(announcement.publish_at, timezone) })
    case 'expired':
      return t('announcements.validity.expired', { date: shortDate(announcement.expires_on ?? '') })
    case 'archived':
      return t('announcements.validity.archived', { date: announcement.archived_at ? shortDateTime(announcement.archived_at, timezone) : '—' })
    default:
      return announcement.expires_on ? t('announcements.validity.until', { date: shortDate(announcement.expires_on) }) : t('announcements.validity.none')
  }
}

/** The Publicado column and the detail subtitle: when and by whom. */
export function publishedLabel(announcement: AnnouncementSummary, timezone: string, t: TFunction): string {
  if (!announcement.published_at) {
    return '—'
  }

  return t('announcements.detail.publishedBy', { date: shortDateTime(announcement.published_at, timezone), name: announcement.author_name ?? '—' })
}
