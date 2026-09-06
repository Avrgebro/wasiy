import { Loader, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '../../lib/money'
import { formatPhone } from '../../lib/phone'
import { useMe } from '../auth/hooks'
import { useActiveUnit } from './active-unit-context'
import { getPortalHousehold, getPortalLedger, getPortalVehicles, type HouseholdMember, type PortalVehicle } from './api'
import { AddMemberSheet, MemberSheet } from './portal-household-sheets'
import { PortalCard, StatusPill } from './portal-cards'
import { VehicleSheet } from './portal-vehicle-sheet'

const householdQueryKey = (unitId?: string) => ['portal', 'household', unitId] as const
const vehiclesQueryKey = (unitId?: string) => ['portal', 'vehicles', unitId] as const

/**
 * Mi unidad (Portal 04/04b): who lives here, the unit's vehicles and, for
 * the primary contact, the balance. Members see the same page without the
 * add-person action and with a note where the ledger would be.
 */
export function PortalMyUnitPage() {
  const { t } = useTranslation('common')
  const me = useMe().data
  const { active } = useActiveUnit()
  const country = me?.resident_memberships.find((membership) => membership.unit_id === active?.unit_id)?.country ?? 'PE'
  const [memberId, setMemberId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [vehicleSheet, setVehicleSheet] = useState<{ open: boolean; vehicle: PortalVehicle | null }>({ open: false, vehicle: null })

  const household = useQuery({ queryKey: householdQueryKey(active?.unit_id), queryFn: () => getPortalHousehold(active!.unit_id), enabled: active !== null })
  const vehicles = useQuery({ queryKey: vehiclesQueryKey(active?.unit_id), queryFn: () => getPortalVehicles(active!.unit_id), enabled: active !== null })
  const canManage = household.data?.can_manage ?? false
  const ledger = useQuery({ queryKey: ['portal', 'ledger', active?.unit_id, 'summary'], queryFn: () => getPortalLedger(active!.unit_id, 'pending'), enabled: active !== null && canManage })

  if (!active) {
    return (
      <Text c="dimmed" size="sm">
        {t('portal.noUnit')}
      </Text>
    )
  }

  const members = household.data?.data ?? []
  const selectedMember = members.find((member) => member.membership_id === memberId) ?? null
  const rows = vehicles.data?.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="m-0 text-2xl font-bold">{t('portal.tabs.myUnit')}</h1>
        <Text c="dimmed" mt={4} size="sm">
          {active.unit_label}
        </Text>
      </div>

      {household.isLoading || vehicles.isLoading ? (
        <div className="grid min-h-24 place-items-center">
          <Loader aria-label={t('common.loading')} />
        </div>
      ) : null}

      {household.data ? (
        <PortalCard action={canManage ? { label: t('portal.household.add'), onClick: () => setAdding(true) } : undefined} count={members.length} title={t('portal.household.title')}>
          {members.map((member) => (
            <MemberRow key={member.membership_id} country={country} member={member} onClick={() => setMemberId(member.membership_id)} />
          ))}
        </PortalCard>
      ) : null}

      {vehicles.data ? (
        <PortalCard action={{ label: t('portal.vehicles.add'), onClick: () => setVehicleSheet({ open: true, vehicle: null }) }} count={rows.length} empty={t('portal.vehicles.empty')} title={t('portal.vehicles.title')}>
          {rows.map((vehicle) => (
            <li key={vehicle.id}>
              <button className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border-0 bg-[var(--wa-surface-2)] px-3 py-2.5 text-left" type="button" onClick={() => setVehicleSheet({ open: true, vehicle })}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-mono text-[13.5px] font-semibold uppercase">{vehicle.plate ?? '—'}</span>
                  <span className="mt-0.5 truncate text-[11.5px] text-[var(--mantine-color-dimmed)]">{[vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(' · ') || t('portal.vehicles.noDetails')}</span>
                </span>
              </button>
            </li>
          ))}
        </PortalCard>
      ) : null}

      {household.data ? (
        canManage ? (
          <section className="overflow-hidden rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <h2 className="m-0 font-display text-[15px] font-semibold">{t('portal.ledger.title')}</h2>
              {ledger.data ? <StatusPill color={ledger.data.balance > 0 ? 'warning' : 'success'}>{ledger.data.balance > 0 ? t('portal.ledger.pending') : t('portal.ledger.upToDate')}</StatusPill> : null}
            </div>
            <div className="px-4 pb-3">
              {ledger.data ? (
                <>
                  <p className="m-0 font-display text-[26px] leading-none font-semibold">{formatMoney(ledger.data.balance)}</p>
                  {ledger.data.last_dues ? (
                    <Text c="dimmed" mt={6} size="xs">
                      {t('portal.ledger.lastDues', { period: periodLabel(ledger.data.last_dues.period), amount: formatMoney(ledger.data.last_dues.amount) })}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Loader aria-label={t('common.loading')} size="sm" />
              )}
            </div>
            <div className="border-t border-[var(--mantine-color-default-border)] px-4 py-2.5">
              <Link className="text-[12.5px] font-semibold text-[var(--wa-interactive)] no-underline" to="/portal/mi-unidad/estado-de-cuenta">
                {t('portal.ledger.view')}
              </Link>
            </div>
          </section>
        ) : (
          <Text c="dimmed" className="px-1" size="xs">
            {t('portal.ledger.primaryOnly')}
          </Text>
        )
      ) : null}

      <MemberSheet canManage={canManage} country={country} member={selectedMember} unitLabel={active.unit_label} onClose={() => setMemberId(null)} />
      <AddMemberSheet country={country} opened={adding} unitId={active.unit_id} onClose={() => setAdding(false)} />
      <VehicleSheet opened={vehicleSheet.open} unitId={active.unit_id} vehicle={vehicleSheet.vehicle} onClose={() => setVehicleSheet((state) => ({ ...state, open: false }))} />
    </div>
  )
}

/** "setiembre" from "2026-09". */
function periodLabel(period: string | null) {
  if (!period) return ''
  const [year, month] = period.split('-').map(Number)

  // ICU builds differ on casing; the line is mid-sentence, so lowercase.
  return new Intl.DateTimeFormat('es-PE', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1))).toLowerCase()
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function MemberRow({ country, member, onClick }: { country: string; member: HouseholdMember; onClick: () => void }) {
  const { t } = useTranslation('common')

  return (
    <li>
      <button className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border-0 bg-[var(--wa-surface-2)] px-3 py-2.5 text-left" type="button" onClick={onClick}>
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--wa-interactive)]/15 text-xs font-bold text-[var(--wa-interactive)]">
          {initials(member.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13.5px] font-semibold">{member.name}</span>
          <span className="mt-0.5 truncate text-[11.5px] text-[var(--mantine-color-dimmed)]">{member.phone ? formatPhone(member.phone, country) : t('portal.household.noPhone')}</span>
        </span>
        <span className="flex shrink-0 gap-1.5">
          {member.is_me ? <StatusPill color="teal">{t('portal.household.you')}</StatusPill> : null}
          {member.is_primary_contact ? <StatusPill color="teal">{t('portal.primaryContact')}</StatusPill> : null}
          {member.portal_state === 'invited' ? <StatusPill color="warning">{t('portal.household.invited')}</StatusPill> : null}
          {member.portal_state === 'not_invited' ? <StatusPill color="gray">{t('portal.household.noAccess')}</StatusPill> : null}
        </span>
      </button>
    </li>
  )
}
