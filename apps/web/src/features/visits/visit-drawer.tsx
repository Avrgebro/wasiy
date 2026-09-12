import { Button, Text, Textarea } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePhoneFormat } from '../auth/hooks'
import { telHref } from '../../lib/phone'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { DrawerFact, DrawerFacts, DrawerSection, DrawerTimeline, type TimelineItem } from '../../components/ui/detail-drawer-parts'
import { notifySuccess } from '../../lib/notify'
import { shortDateTime } from '../finances/month'
import { checkOutVisit, type VisitSummary } from './api'
import { checkInLabel, durationLabel, visitStatusColor } from './visit-presentation'
import { StatusPill } from '../../components/ui/chips'
import { formatUnitLabel } from '../units/unit-label'

/** Mockup 16 drawer: time inside (live), facts, timeline, Marcar salida. */
export function VisitDrawer({ onClose, timezone, visit }: { onClose: () => void; timezone: string; visit: VisitSummary | null }) {
  const { t } = useTranslation('common')
  const formatPhone = usePhoneFormat()
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState('')
  const [now, setNow] = useState(() => new Date())

  // The duration ticks once a minute while an open visit is on screen.
  useEffect(() => {
    if (!visit || visit.status !== 'inside') {
      return
    }
    const timer = window.setInterval(() => setNow(new Date()), 60_000)

    return () => window.clearInterval(timer)
  }, [visit])

  const close = () => {
    setNotes('')
    onClose()
  }

  const checkOut = useMutation({
    mutationFn: () => checkOutVisit(visit!.id, notes.trim() || null),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['visits'] }), queryClient.invalidateQueries({ queryKey: ['registry', 'units'] })])
      close()
      notifySuccess(t('visits.checkedOut'))
    },
  })

  const inside = visit?.status === 'inside'

  return (
    <AppDrawer
      opened={visit !== null}
      subtitle={
        visit
          ? inside
            ? t('visits.detail.insideSince', { unit: formatUnitLabel(visit), time: checkInLabel(visit.checked_in_at, timezone, now) })
            : t('visits.detail.range', {
                unit: formatUnitLabel(visit),
                from: checkInLabel(visit.checked_in_at, timezone, now),
                to: visit.checked_out_at ? checkInLabel(visit.checked_out_at, timezone, now) : '—',
              })
          : undefined
      }
      title={visit?.visitor_name ?? ''}
      onClose={close}
    >
      <AppDrawerBody>
        {visit ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill color={visitStatusColor(visit.status)}>
                {t(`visits.statuses.${visit.status}`)}
              </StatusPill>
              <span className="font-mono text-2xl font-semibold">{durationLabel(visit, now, t)}</span>
              <Text c="dimmed" size="sm">
                {t(inside ? 'visits.detail.insideBuilding' : 'visits.detail.duration')}
              </Text>
            </div>

            <DrawerFacts>
              <DrawerFact
                label={t('packages.columns.unit')}
                value={
                  <Link className="text-[var(--wa-interactive)] no-underline hover:underline" params={{ unitId: visit.unit_id }} to="/admin/units/$unitId">
                    {formatUnitLabel(visit)} →
                  </Link>
                }
              />
              <DrawerFact
                label={t('visits.columns.host')}
                value={
                  visit.resident_name ? (
                    <>
                      {visit.resident_name}
                      {visit.resident_phone ? (
                        <>
                          {' · '}
                          <a className="text-[var(--wa-interactive)] no-underline hover:underline" href={telHref(visit.resident_phone)}>
                            {formatPhone(visit.resident_phone)}
                          </a>
                        </>
                      ) : null}
                    </>
                  ) : (
                    t('visits.unitOnly', { unit: formatUnitLabel(visit) })
                  )
                }
              />
              <DrawerFact label={t('visits.columns.confirmation')} value={t(`visits.confirmations.${visit.confirmation}`)} />
              <DrawerFact label={t('visits.form.documentShort')} value={visit.document ?? '—'} />
              <DrawerFact label={t('registry.residents.phone')} value={visit.phone ? formatPhone(visit.phone) : '—'} />
              {visit.notes ? <DrawerFact wide label={t('registry.notes')} value={visit.notes} /> : null}
            </DrawerFacts>

            <DrawerSection label={t('finances.history.title')} />
            <DrawerTimeline items={timeline(visit, timezone, t)} />

            <DrawerSection label={t('finances.detail.actions')} />
            {inside ? (
              <>
                <Textarea label={t('visits.detail.checkoutNotes')} placeholder={t('visits.detail.checkoutNotesPlaceholder')} value={notes} onChange={(event) => setNotes(event.currentTarget.value)} />
                <Button color="accent" fullWidth loading={checkOut.isPending} onClick={() => checkOut.mutate()}>
                  {t('visits.markOut')}
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

function timeline(visit: VisitSummary, timezone: string, t: (key: string, options?: Record<string, unknown>) => string): TimelineItem[] {
  const items: TimelineItem[] = []

  if (visit.checked_out_at) {
    items.push({
      id: 'out',
      when: shortDateTime(visit.checked_out_at, timezone),
      label: visit.auto_checked_out
        ? t('visits.timeline.autoOut')
        : visit.checkout_notes
          ? `${t('visits.timeline.out')}: ${visit.checkout_notes}`
          : t('visits.timeline.out'),
      actor: visit.auto_checked_out ? t('finances.history.system') : (visit.checked_out_by_name ?? '—'),
    })
  }

  if (visit.pre_registered_at) {
    items.push({ id: 'pre', when: shortDateTime(visit.pre_registered_at, timezone), label: t('visits.timeline.preRegistered'), actor: visit.pre_registered_by_name ?? '—' })
  }
  if (visit.checked_in_at) {
    items.push({ id: 'in', when: shortDateTime(visit.checked_in_at, timezone), label: t('visits.timeline.in'), actor: visit.checked_in_by_name ?? '—' })
  }

  if (visit.confirmation !== 'none') {
    items.push({
      id: 'confirmed',
      when: shortDateTime(visit.checked_in_at ?? visit.pre_registered_at ?? '', timezone),
      label: visit.resident_name
        ? t('visits.timeline.confirmedWith', { method: t(`visits.confirmations.${visit.confirmation}`), name: visit.resident_name })
        : t('visits.timeline.confirmed', { method: t(`visits.confirmations.${visit.confirmation}`) }),
      actor: visit.checked_in_by_name ?? '—',
    })
  }

  return items
}
