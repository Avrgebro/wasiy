import { Button, Text, Textarea } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { DrawerFact, DrawerFacts, DrawerSection, DrawerTimeline, type TimelineItem } from '../../components/ui/detail-drawer-parts'
import { notifySuccess } from '../../lib/notify'
import { shortDate, shortDateTime } from '../finances/month'
import { deliverPackage, type PackageSummary } from './api'
import { packageStatusColor } from './presentation'
import { StatusPill } from '../../components/ui/chips'

/** Mockup 14 drawer: the facts and the one action, Marcar entregado. */
export function PackageDrawer({
  onClose,
  pkg,
  timezone,
}: {
  onClose: () => void
  pkg: PackageSummary | null
  timezone: string
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [deliveryNotes, setDeliveryNotes] = useState('')

  const close = () => {
    setDeliveryNotes('')
    onClose()
  }

  const deliver = useMutation({
    mutationFn: () => deliverPackage(pkg!.id, deliveryNotes.trim() || null),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['packages'] }),
        queryClient.invalidateQueries({ queryKey: ['registry', 'units'] }),
      ])
      close()
      notifySuccess(t('packages.delivered'))
    },
  })

  const pending = pkg?.status === 'pending'

  return (
    <AppDrawer
      opened={pkg !== null}
      subtitle={
        pkg
          ? pending
            ? t('packages.detail.pendingSince', { date: shortDate(pkg.received_at.slice(0, 10)) })
            : t('packages.detail.deliveredOn', { date: pkg.delivered_at ? shortDate(pkg.delivered_at.slice(0, 10)) : '—' })
          : undefined
      }
      title={pkg ? t('packages.detail.title', { unit: pkg.unit_number ?? '' }) : ''}
      onClose={close}
    >
      <AppDrawerBody>
        {pkg ? (
          <>
            <StatusPill className="self-start" color={packageStatusColor(pkg.status)}>
              {t(`packages.statuses.${pkg.status}`)}
            </StatusPill>
            <DrawerFacts>
              <DrawerFact
                label={t('packages.columns.unit')}
                value={
                  <Link className="text-[var(--wa-interactive)] no-underline hover:underline" params={{ unitId: pkg.unit_id }} to="/admin/units/$unitId">
                    {[pkg.unit_number, pkg.building_name].filter(Boolean).join(' · ')} →
                  </Link>
                }
              />
              <DrawerFact label={t('packages.columns.for')} value={pkg.resident_name ?? t('packages.primaryContact')} />
              {pkg.notes ? <DrawerFact wide label={t('registry.notes')} value={pkg.notes} /> : null}
            </DrawerFacts>

            <DrawerSection label={t('finances.history.title')} />
            <DrawerTimeline items={timeline(pkg, timezone, t)} />

            <DrawerSection label={t('finances.detail.actions')} />
            {pending ? (
              <>
                <Textarea
                  label={t('packages.detail.deliveryNotesLabel')}
                  placeholder={t('packages.detail.deliveryNotesPlaceholder')}
                  value={deliveryNotes}
                  onChange={(event) => setDeliveryNotes(event.currentTarget.value)}
                />
                <Button color="accent" fullWidth loading={deliver.isPending} onClick={() => deliver.mutate()}>
                  {t('packages.markDelivered')}
                </Button>
              </>
            ) : (
              <Text c="dimmed" size="sm">
                {t('packages.detail.noActions')}
              </Text>
            )}
          </>
        ) : null}
      </AppDrawerBody>
      <AppDrawerFooter>
        <Button className="mr-auto" variant="subtle" onClick={close}>
          {t('finances.detail.close')}
        </Button>
      </AppDrawerFooter>
    </AppDrawer>
  )
}

/** Received → notified → delivered, newest first, from the record itself. */
function timeline(pkg: PackageSummary, timezone: string, t: (key: string, options?: Record<string, unknown>) => string): TimelineItem[] {
  const items: TimelineItem[] = []

  if (pkg.delivered_at) {
    items.push({
      id: 'delivered',
      when: shortDateTime(pkg.delivered_at, timezone),
      label: pkg.delivery_notes ? `${t('packages.timeline.delivered')}: ${pkg.delivery_notes}` : t('packages.timeline.delivered'),
      actor: pkg.delivered_by_name ?? '—',
    })
  }

  items.push({
    id: 'notice',
    when: shortDateTime(pkg.received_at, timezone),
    label: pkg.notified_email
      ? t('packages.timeline.notified', { email: pkg.notified_email })
      : t('packages.timeline.notNotified'),
    actor: t('finances.history.system'),
  })

  items.push({
    id: 'received',
    when: shortDateTime(pkg.received_at, timezone),
    label: t('packages.timeline.received'),
    actor: pkg.received_by_name ?? '—',
  })

  return items
}
