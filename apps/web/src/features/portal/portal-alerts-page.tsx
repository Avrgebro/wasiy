import { Button, Loader, Text } from '@mantine/core'
import { AltArrowLeft } from '@solar-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'
import { notifyError } from '../../lib/notify'
import { useMe } from '../auth/hooks'
import { useActiveUnit } from './active-unit-context'
import { getPortalAlerts, markAllPortalAlertsRead, markPortalAlertRead, type PortalAlert } from './api'
import { alertAge } from './presentation'

type Chip = 'new' | 'all'

const alertsQueryKey = (unitId?: string) => ['portal', 'alerts', unitId] as const

/**
 * Alertas (Portal 03b): the bell's full-screen list for the active unit.
 * Opening a row marks it read and goes to what it is about; the amber dot
 * leaves and the row settles onto the plain surface.
 */
export function PortalAlertsPage() {
  const { t } = useTranslation('common')
  const me = useMe().data
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { active } = useActiveUnit()
  const [chip, setChip] = useState<Chip>('new')
  const now = new Date()
  const timezone = me?.active_location?.timezone ?? 'America/Lima'

  const list = useQuery({ queryKey: [...alertsQueryKey(active?.unit_id), chip], queryFn: () => getPortalAlerts(active!.unit_id, chip), enabled: active !== null })
  const unread = useQuery({ queryKey: [...alertsQueryKey(active?.unit_id), 'new'], queryFn: () => getPortalAlerts(active!.unit_id, 'new'), enabled: active !== null }).data?.meta.total ?? 0

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: alertsQueryKey(active?.unit_id) })
  }

  const markAll = useMutation({
    mutationFn: () => markAllPortalAlertsRead(active!.unit_id),
    onSuccess: refresh,
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  const open = useMutation({
    mutationFn: (alert: PortalAlert) => (alert.read_at ? Promise.resolve(null) : markPortalAlertRead(alert.id)),
    onSuccess: async (_result, alert) => {
      await refresh()
      // Where a row leads: the booking sheet, the home's package card, or the door log. Announcements wait for P5.
      if (alert.subject_type === 'reservation') void navigate({ to: '/portal/reservas', search: { chip: 'mine', reserva: alert.subject_id ?? undefined } })
      else if (alert.subject_type === 'package') void navigate({ to: '/portal' })
      else if (alert.subject_type === 'visit') void navigate({ to: '/portal/visitas' })
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link aria-label={t('actions.back')} className="-ml-2 grid h-9 w-9 place-items-center rounded-full text-[var(--mantine-color-text)]" to="/portal">
            <AltArrowLeft size={20} />
          </Link>
          <h1 className="m-0 text-2xl font-bold">{t('portal.alerts.title')}</h1>
        </div>
        <Button disabled={unread === 0} loading={markAll.isPending} size="xs" variant="subtle" onClick={() => markAll.mutate()}>
          {t('portal.alerts.markAllRead')}
        </Button>
      </div>

      <div className="flex gap-2" role="tablist">
        {(['new', 'all'] as Chip[]).map((key) => (
          <button
            key={key}
            aria-selected={chip === key}
            className={`min-h-9 cursor-pointer rounded-full border px-4 text-xs font-semibold ${chip === key ? 'border-[var(--wa-accent)] bg-[var(--wa-accent)] text-[#1c2b2c]' : 'border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] text-[var(--mantine-color-dimmed)]'}`}
            role="tab"
            type="button"
            onClick={() => setChip(key)}
          >
            {key === 'new' && unread > 0 ? `${t('portal.alerts.chips.new')} · ${unread}` : t(`portal.alerts.chips.${key}`)}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="grid min-h-24 place-items-center">
          <Loader aria-label={t('common.loading')} />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-10 text-center">
          <Text fw={600} size="sm">
            {t('portal.alerts.empty')}
          </Text>
          <Text c="dimmed" size="xs">
            {t(chip === 'new' ? 'portal.alerts.emptyNewHint' : 'portal.alerts.emptyAllHint')}
          </Text>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((alert) => {
            const isUnread = alert.read_at === null

            return (
              <li key={alert.id}>
                <button
                  aria-label={isUnread ? `${alert.title} · ${t('portal.alerts.unread')}` : alert.title}
                  className={`flex min-h-16 w-full cursor-pointer items-start gap-3 rounded-inner border border-[var(--mantine-color-default-border)] px-3.5 py-3 text-left ${isUnread ? 'bg-[var(--wa-surface-2)]' : 'bg-[var(--mantine-color-default)]'}`}
                  type="button"
                  onClick={() => open.mutate(alert)}
                >
                  <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isUnread ? 'bg-[var(--wa-accent)]' : 'bg-transparent'}`} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={`text-sm ${isUnread ? 'font-semibold' : 'font-medium'}`}>{alert.title}</span>
                    {alert.body ? <span className="line-clamp-2 text-xs text-[var(--mantine-color-dimmed)]">{alert.body}</span> : null}
                  </span>
                  <span className="shrink-0 pt-0.5 text-[11px] text-[var(--mantine-color-dimmed)]">{alertAge(alert.created_at, now, timezone, t)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
