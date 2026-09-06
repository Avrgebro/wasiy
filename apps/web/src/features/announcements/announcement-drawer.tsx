import { Badge, Button, Text, Typography } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { ConfirmDialog, DrawerSection } from '../../components/ui/detail-drawer-parts'
import { getErrorMessage } from '../../lib/errors'
import { notifyError, notifySuccess } from '../../lib/notify'
import { shortDateTime } from '../finances/month'
import { archiveAnnouncement, type AnnouncementSummary } from './api'
import { publishedLabel, validityLabel } from './presentation'

/** Mockup 18c: the rendered post, who it reached, and the two actions. */
export function AnnouncementDrawer({
  announcement,
  canManage,
  onClose,
  onEdit,
  timezone,
}: {
  announcement: AnnouncementSummary | null
  canManage: boolean
  onClose: () => void
  onEdit: (announcement: AnnouncementSummary) => void
  timezone: string
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const archive = useMutation({
    mutationFn: () => archiveAnnouncement(announcement!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['announcements'] })
      setConfirming(false)
      onClose()
      notifySuccess(t('announcements.archived'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  const open = announcement !== null && announcement.status !== 'archived'

  return (
    <AppDrawer
      opened={announcement !== null}
      subtitle={
        announcement
          ? [
              t(`announcements.statuses.${announcement.status}`),
              validityLabel(announcement, timezone, t),
              announcement.published_at ? publishedLabel(announcement, timezone, t) : t('announcements.detail.scheduledFor', { date: shortDateTime(announcement.publish_at, timezone) }),
            ].join(' · ')
          : undefined
      }
      title={
        announcement ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>{announcement.title}</span>
            {announcement.is_important ? (
              <Badge color="accent" radius="sm" size="sm" variant="light">
                {t('announcements.important')}
              </Badge>
            ) : null}
          </span>
        ) : (
          ''
        )
      }
      onClose={onClose}
    >
      <AppDrawerBody>
        {announcement ? (
          <>
            {/* body_html is rendered by the API from the Markdown subset with raw HTML stripped. */}
            <Typography className="text-sm leading-relaxed [&_a]:text-[var(--wa-interactive)] [&_p]:my-2.5 [&_ul]:my-2.5 [&_ol]:my-2.5">
              <div dangerouslySetInnerHTML={{ __html: announcement.body_html }} />
            </Typography>

            {announcement.published_at ? (
              <div className="grid grid-cols-2 gap-2.5">
                <Fact label={t('announcements.detail.notified')} value={t('announcements.detail.notifiedValue', { count: announcement.notified_count })} />
                <Fact
                  label={t('announcements.detail.email')}
                  value={announcement.emailed_count > 0 ? t('announcements.detail.emailValue', { count: announcement.emailed_count }) : t('announcements.detail.emailNone')}
                />
              </div>
            ) : null}

            {canManage && open ? (
              <>
                <DrawerSection label={t('announcements.detail.actions')} />
                <div className="grid grid-cols-2 gap-2.5">
                  <Button variant="default" onClick={() => onEdit(announcement)}>
                    {t('actions.edit')}
                  </Button>
                  <Button variant="default" onClick={() => setConfirming(true)}>
                    {t('announcements.detail.archive')}
                  </Button>
                </div>
                <Text c="dimmed" size="xs">
                  {t('announcements.detail.archiveHint')}
                </Text>
                <ConfirmDialog
                  body={t('announcements.detail.confirmArchiveBody')}
                  opened={confirming}
                  title={t('announcements.detail.confirmArchiveTitle', { title: announcement.title })}
                  onCancel={() => setConfirming(false)}
                  onConfirm={() => archive.mutate()}
                />
              </>
            ) : null}
          </>
        ) : null}
      </AppDrawerBody>
      <AppDrawerFooter>
        <Button className="mr-auto" variant="subtle" onClick={onClose}>
          {t('finances.detail.close')}
        </Button>
      </AppDrawerFooter>
    </AppDrawer>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-3.5 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mantine-color-dimmed)]">{label}</div>
      <div className="mt-1.5 font-display text-[15px] font-semibold">{value}</div>
    </div>
  )
}
