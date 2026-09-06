import { UnstyledButton } from '@mantine/core'
import { AltArrowDown, Bell, CheckCircle } from '@solar-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ActiveUnitProvider } from '../../../features/portal/active-unit'
import { useActiveUnit } from '../../../features/portal/active-unit-context'
import { getPortalUnreadCount } from '../../../features/portal/api'
import { BottomSheet } from '../../ui/bottom-sheet'
import { ColorSchemeToggle } from '../shared/color-scheme-toggle'
import type { LayoutNavEntry, LayoutNavLeaf } from '../shared/types'

type PortalLayoutProps = {
  children: ReactNode
  navItems: LayoutNavEntry[]
}

function leaves(navItems: LayoutNavEntry[]): LayoutNavLeaf[] {
  return navItems.flatMap((entry) => {
    if ('type' in entry && entry.type === 'group') return leaves(entry.items)
    if ('type' in entry && entry.type === 'collapsible') return entry.children

    return [entry as LayoutNavLeaf]
  })
}

/** The bell (mockup 03): an amber count while something is unread, plain when nothing is. Polled once a minute. */
function AlertsBell({ unitId }: { unitId?: string }) {
  const { t } = useTranslation('common')
  const unread = useQuery({
    queryKey: ['portal', 'alerts', unitId, 'unread-count'],
    queryFn: () => getPortalUnreadCount(unitId!),
    enabled: unitId !== undefined,
    refetchInterval: 60_000,
  }).data?.unread ?? 0

  return (
    <Link aria-label={unread > 0 ? t('portal.alerts.bellUnread', { count: unread }) : t('portal.alerts.title')} className="relative grid h-9 w-9 place-items-center rounded-full text-[var(--mantine-color-text)]" to="/portal/alertas">
      <Bell aria-hidden size={22} />
      {unread > 0 ? (
        <span aria-hidden className="absolute -top-0.5 -right-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--wa-accent)] px-1 text-[10px] font-bold text-[#1c2b2c]">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  )
}

/**
 * The resident portal shell (Portal.dc.html): one column capped at phone
 * width, a compact header with the active unit as a pill, and a fixed tab
 * bar. No sidebar, no search; the bell carries the unread count (P3).
 */
export function PortalLayout({ children, navItems }: PortalLayoutProps) {
  return (
    <ActiveUnitProvider>
      <PortalShell navItems={navItems}>{children}</PortalShell>
    </ActiveUnitProvider>
  )
}

function PortalShell({ children, navItems }: PortalLayoutProps) {
  const { t } = useTranslation('common')
  const { active, units, select } = useActiveUnit()
  const [switching, setSwitching] = useState(false)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const tabs = leaves(navItems)

  return (
    <div className="flex min-h-full flex-col bg-[var(--mantine-color-body)] text-[var(--mantine-color-text)]">
      <header className="sticky top-0 z-10 border-b border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[30rem] items-center justify-between gap-3 px-4">
          <Link aria-label={t('portal.home')} className="font-display text-lg font-semibold text-[var(--mantine-color-text)] no-underline" to="/portal">
            W
          </Link>
          {active ? (
            <UnstyledButton
              aria-haspopup="dialog"
              aria-label={t('portal.unit.switch')}
              className="flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-3.5 text-sm font-semibold"
              disabled={units.length < 2}
              onClick={() => setSwitching(true)}
            >
              <span>{active.unit_label}</span>
              {units.length > 1 ? <AltArrowDown aria-hidden size={14} /> : null}
            </UnstyledButton>
          ) : null}
          <div className="flex items-center gap-1">
            <AlertsBell unitId={active?.unit_id} />
            <ColorSchemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[30rem] flex-1 px-4 pt-4 pb-24">{children}</main>

      <nav aria-label={t('shell.mainNav')} className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]/95 backdrop-blur">
        <ul className="mx-auto m-0 flex max-w-[30rem] list-none justify-around p-0 pb-[env(safe-area-inset-bottom)]">
          {tabs.map((tab) => {
            const current = tab.to === '/portal' ? pathname === '/portal' || pathname === '/portal/' : pathname.startsWith(tab.to)
            const Icon = tab.icon

            return (
              <li key={tab.to} className="flex-1">
                <Link
                  aria-current={current ? 'page' : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold no-underline ${current ? 'text-[var(--wa-interactive)]' : 'text-[var(--mantine-color-dimmed)]'}`}
                  to={tab.to}
                >
                  <Icon aria-hidden size={22} weight={current ? 'Bold' : 'Linear'} />
                  {t(tab.labelKey)}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <BottomSheet lines={[t('portal.unit.switchHint')]} opened={switching} title={t('portal.unit.mine')} onClose={() => setSwitching(false)}>
        <ul className="m-0 flex list-none flex-col gap-2 p-0" role="radiogroup" aria-label={t('portal.unit.mine')}>
          {units.map((unit) => {
            const selected = unit.unit_id === active?.unit_id

            return (
              <li key={unit.unit_membership_id}>
                <UnstyledButton
                  aria-checked={selected}
                  className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-inner border px-4 text-left ${selected ? 'border-[var(--wa-interactive)] bg-[var(--wa-surface-2)]' : 'border-[var(--mantine-color-default-border)]'}`}
                  role="radio"
                  onClick={() => {
                    select(unit.unit_id)
                    setSwitching(false)
                  }}
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{unit.unit_label}</span>
                    {unit.is_primary_contact ? <span className="text-xs text-[var(--mantine-color-dimmed)]">{t('portal.primaryContact')}</span> : null}
                  </span>
                  {selected ? <CheckCircle aria-hidden className="text-[var(--wa-interactive)]" size={20} weight="Bold" /> : null}
                </UnstyledButton>
              </li>
            )
          })}
        </ul>
      </BottomSheet>
    </div>
  )
}
