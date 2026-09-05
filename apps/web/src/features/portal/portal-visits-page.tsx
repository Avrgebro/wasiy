import { ActionIcon, Button, Loader, Text } from '@mantine/core'
import { AddCircle } from '@solar-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../components/ui/bottom-sheet'
import { ConfirmDialog, DrawerFact, DrawerFacts, DrawerTimeline, type TimelineItem } from '../../components/ui/detail-drawer-parts'
import { getErrorMessage } from '../../lib/errors'
import { notifyError, notifySuccess } from '../../lib/notify'
import { useMe } from '../auth/hooks'
import { useActiveUnit } from './active-unit-context'
import { cancelPortalVisit, getPortalVisits, type PortalVisit } from './api'
import { PortalRow, StatusPill } from './portal-cards'
import { arrivedAt, doorLabel, expectedLabel, monthHeading, statusTone } from './presentation'

type Chip = 'expected' | 'history'

/** Visitas (Portal 01b/01d): what the resident announced and what happened at the door. */
export function PortalVisitsPage() {
  const { t } = useTranslation('common')
  const me = useMe().data
  const { active } = useActiveUnit()
  const queryClient = useQueryClient()
  const [chip, setChip] = useState<Chip>('expected')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const now = new Date()
  const timezone = me?.active_location?.timezone ?? 'America/Lima'

  const list = useQuery({ queryKey: ['portal', 'visits', active?.unit_id, chip], queryFn: () => getPortalVisits(active!.unit_id, chip), enabled: active !== null })
  const expectedCount = useQuery({ queryKey: ['portal', 'visits', active?.unit_id, 'expected'], queryFn: () => getPortalVisits(active!.unit_id, 'expected'), enabled: active !== null }).data?.meta.total

  const cancel = useMutation({
    mutationFn: (visit: PortalVisit) => cancelPortalVisit(visit.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portal', 'visits'] })
      setConfirmingCancel(false)
      setSelectedId(null)
      notifySuccess(t('portal.visits.cancelled'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  if (!active) {
    return (
      <Text c="dimmed" size="sm">
        {t('portal.noUnit')}
      </Text>
    )
  }

  const rows = list.data?.data ?? []
  const selected = rows.find((visit) => visit.id === selectedId) ?? null

  function pillFor(visit: PortalVisit) {
    if (visit.status === 'expected') return t('portal.visits.status.expected')
    if (visit.status === 'cancelled') return t('portal.visits.status.cancelled')

    return chip === 'history' ? t('portal.visits.status.arrived') : t('portal.visits.arrivedAt', { time: arrivedAt(visit, timezone) })
  }

  // History groups by the month of the door event (or the expected day for stale pre-registrations).
  const groups = rows.reduce<{ heading: string; visits: PortalVisit[] }[]>((acc, visit) => {
    const anchor = visit.checked_in_at ?? visit.cancelled_at ?? (visit.expected_on ? `${visit.expected_on}T12:00:00Z` : null)
    const heading = chip === 'history' && anchor ? monthHeading(anchor, timezone) : ''
    const last = acc[acc.length - 1]
    if (last && last.heading === heading) last.visits.push(visit)
    else acc.push({ heading, visits: [visit] })

    return acc
  }, [])

  const timeline: TimelineItem[] = selected
    ? [
        selected.pre_registered_at ? { id: 'pre', when: new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(new Date(selected.pre_registered_at)), label: t('portal.visits.timeline.preRegistered'), actor: selected.pre_registered_by_name ?? '' } : null,
        selected.checked_in_at ? { id: 'in', when: new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(new Date(selected.checked_in_at)), label: t('portal.visits.timeline.arrived'), actor: selected.checked_in_by_name ? t('portal.visits.timeline.byDesk', { name: selected.checked_in_by_name }) : '' } : null,
        selected.checked_out_at ? { id: 'out', when: new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(new Date(selected.checked_out_at)), label: selected.auto_checked_out ? t('portal.visits.timeline.leftAuto') : t('portal.visits.timeline.left'), actor: '' } : null,
        selected.cancelled_at ? { id: 'cancel', when: new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(new Date(selected.cancelled_at)), label: t('portal.visits.timeline.cancelled'), actor: '' } : null,
      ].filter((item): item is TimelineItem => item !== null)
    : []

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-2xl font-bold">{t('portal.tabs.visits')}</h1>
        <Text c="dimmed" mt={4} size="sm">
          {active.unit_label}
        </Text>
      </div>

      <div className="flex gap-2" role="tablist">
        {(['expected', 'history'] as Chip[]).map((key) => (
          <button
            key={key}
            aria-selected={chip === key}
            className={`min-h-9 cursor-pointer rounded-full border px-4 text-xs font-semibold ${chip === key ? 'border-[var(--wa-accent)] bg-[var(--wa-accent)] text-[#1c2b2c]' : 'border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] text-[var(--mantine-color-dimmed)]'}`}
            role="tab"
            type="button"
            onClick={() => setChip(key)}
          >
            {key === 'expected' && expectedCount !== undefined ? `${t('portal.visits.chips.expected')} · ${expectedCount}` : t(`portal.visits.chips.${key}`)}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="grid min-h-24 place-items-center">
          <Loader aria-label={t('common.loading')} />
        </div>
      ) : rows.length === 0 ? (
        <Text c="dimmed" className="py-6 text-center" size="sm">
          {t(chip === 'expected' ? 'portal.visits.emptyExpected' : 'portal.visits.emptyHistory')}
        </Text>
      ) : (
        groups.map((group, index) => (
          <div key={`${group.heading}-${index}`} className="flex flex-col gap-2">
            {group.heading ? <h2 className="m-0 text-[11px] font-bold uppercase tracking-widest text-[var(--wa-text-3)]">{group.heading}</h2> : null}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {group.visits.map((visit) => (
                <PortalRow
                  key={visit.id}
                  pill={<StatusPill color={statusTone(visit.status)}>{pillFor(visit)}</StatusPill>}
                  primary={visit.visitor_name}
                  secondary={visit.checked_in_at ? doorLabel(visit, timezone) : expectedLabel(visit, now, timezone, t) || null}
                  onClick={() => setSelectedId(visit.id)}
                />
              ))}
            </ul>
          </div>
        ))
      )}

      <ActionIcon aria-label={t('portal.visits.preRegister')} className="fixed right-5 bottom-20 shadow-lg" color="accent" component={Link} radius="xl" size={56} to="/portal/visitas/nueva" variant="filled">
        <AddCircle size={26} />
      </ActionIcon>

      <BottomSheet
        description={selected ? `${active.unit_label} · ${selected.checked_in_at ? doorLabel(selected, timezone) : expectedLabel(selected, now, timezone, t)}` : undefined}
        opened={selected !== null}
        title={selected?.visitor_name ?? ''}
        onClose={() => setSelectedId(null)}
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <DrawerFacts>
              <DrawerFact label={t('portal.visits.status.label')} value={<StatusPill color={statusTone(selected.status)}>{pillFor(selected)}</StatusPill>} />
              {selected.document ? <DrawerFact label={t('portal.visits.form.document')} value={selected.document} /> : null}
              {selected.notes ? <DrawerFact label={t('portal.visits.form.note')} value={selected.notes} wide /> : null}
            </DrawerFacts>
            <DrawerTimeline items={timeline} />
            {selected.status === 'expected' ? (
              <>
                <Button className="w-full" color="error" variant="default" onClick={() => setConfirmingCancel(true)}>
                  {t('portal.visits.cancel')}
                </Button>
                <Text c="dimmed" size="xs">
                  {t('portal.visits.cancelHint')}
                </Text>
              </>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        body={t('portal.visits.cancelBody')}
        opened={confirmingCancel}
        title={t('portal.visits.cancelTitle', { name: selected?.visitor_name ?? '' })}
        onCancel={() => setConfirmingCancel(false)}
        onConfirm={() => selected && cancel.mutate(selected)}
      />
    </div>
  )
}
