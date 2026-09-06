import { ActionIcon, Loader, Text } from '@mantine/core'
import { AltArrowLeft } from '@solar-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '../../lib/money'
import { useActiveUnit } from './active-unit-context'
import { getPortalLedger, type LedgerRow } from './api'
import { StatusPill } from './portal-cards'
import { monthHeading } from './presentation'

type Chip = 'pending' | 'all'

/**
 * Estado de cuenta (Portal 04f): a full screen for the primary contact.
 * Balance on top, pending or all movements grouped by month. Rows open
 * nothing: the portal informs, administration collects.
 */
export function PortalLedgerPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const { active } = useActiveUnit()
  const [chip, setChip] = useState<Chip>('pending')

  const ledger = useQuery({ queryKey: ['portal', 'ledger', active?.unit_id, chip], queryFn: () => getPortalLedger(active!.unit_id, chip), enabled: active !== null })

  if (!active) {
    return (
      <Text c="dimmed" size="sm">
        {t('portal.noUnit')}
      </Text>
    )
  }

  const rows = ledger.data?.data ?? []
  const groups = rows.reduce<{ heading: string; rows: LedgerRow[] }[]>((acc, row) => {
    const heading = monthHeading(`${row.occurred_on}T12:00:00Z`, 'UTC')
    const last = acc[acc.length - 1]
    if (last && last.heading === heading) last.rows.push(row)
    else acc.push({ heading, rows: [row] })

    return acc
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ActionIcon aria-label={t('actions.back')} radius={10} size={40} variant="default" onClick={() => void navigate({ to: '/portal/mi-unidad' })}>
          <AltArrowLeft size={18} />
        </ActionIcon>
        <h1 className="m-0 text-xl font-bold">{t('portal.ledger.title')}</h1>
      </div>

      <section className="rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] px-4 py-3.5">
        {ledger.data ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 font-display text-[30px] leading-none font-semibold">{formatMoney(ledger.data.balance)}</p>
              <Text c="dimmed" mt={6} size="xs">
                {t('portal.ledger.updatedToday')}
              </Text>
            </div>
            <StatusPill color={ledger.data.balance > 0 ? 'warning' : 'success'}>{ledger.data.balance > 0 ? t('portal.ledger.pending') : t('portal.ledger.upToDate')}</StatusPill>
          </div>
        ) : (
          <Loader aria-label={t('common.loading')} size="sm" />
        )}
      </section>

      <div className="flex gap-2" role="tablist">
        {(['pending', 'all'] as Chip[]).map((key) => (
          <button
            key={key}
            aria-selected={chip === key}
            className={`min-h-9 cursor-pointer rounded-full border px-4 text-xs font-semibold ${chip === key ? 'border-[var(--wa-accent)] bg-[var(--wa-accent)] text-[#1c2b2c]' : 'border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] text-[var(--mantine-color-dimmed)]'}`}
            role="tab"
            type="button"
            onClick={() => setChip(key)}
          >
            {key === 'pending' && ledger.data ? `${t('portal.ledger.chips.pending')} · ${ledger.data.pending_count}` : t(`portal.ledger.chips.${key}`)}
          </button>
        ))}
      </div>

      {ledger.isLoading ? (
        <div className="grid min-h-24 place-items-center">
          <Loader aria-label={t('common.loading')} />
        </div>
      ) : rows.length === 0 ? (
        <Text c="dimmed" className="py-6 text-center" size="sm">
          {t('portal.ledger.empty')}
        </Text>
      ) : (
        groups.map((group) => (
          <div key={group.heading} className="flex flex-col gap-2">
            <h2 className="m-0 text-[11px] font-bold uppercase tracking-widest text-[var(--wa-text-3)]">{group.heading}</h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {group.rows.map((row) => (
                <li key={row.id} className="flex min-h-14 items-center gap-3 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-3.5 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{row.concept}</span>
                    <span className="text-xs text-[var(--mantine-color-dimmed)]">{shortDate(row.occurred_on)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`text-sm font-semibold ${row.amount < 0 ? 'text-[var(--wa-success)]' : ''}`}>{formatMoney(row.amount)}</span>
                    <StatusPill color={row.state === 'pending' ? 'warning' : 'gray'}>{row.state === 'pending' ? t('portal.ledger.pending') : t('portal.ledger.paid')}</StatusPill>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      <Text c="dimmed" className="pb-2 text-center" size="xs">
        {t('portal.ledger.footer')}
      </Text>
    </div>
  )
}

/** "1 set" */
function shortDate(iso: string) {
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`)).replace('.', '')
}
