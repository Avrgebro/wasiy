import { Avatar, Text } from '@mantine/core'
import { ShieldCheckIcon } from '@solar-icons/react/linear'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ThemePicker } from '../../components/ui/theme-picker'
import { getRoleLabelKey } from '../auth/access'
import { useLocationContext, useMe } from '../auth/hooks'
import type { MeResponse } from '../auth/types'
import { AccountCard } from './account-card'
import { EmailCard } from './email-card'
import { PasswordCard } from './password-card'
import { PersonalDataCard } from './personal-data-card'
import { SessionsCard } from './sessions-card'

/**
 * /admin/account, "Mi cuenta" (mockup 21): one 720px column of blocks from
 * the most stable to the most sensitive. Almost everything is read-only;
 * what is editable saves per block, never with a global button. Every staff
 * role reaches it from the avatar menu.
 */
export function AccountPage() {
  const { t } = useTranslation('common')
  const me = useMe().data
  const { currentLocation } = useLocationContext()

  if (!me) return null

  const role =
    me.roles.account[0]?.role ??
    me.roles.location.find((assignment) => assignment.location_id === currentLocation?.id)?.role

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <div className="min-w-0">
        <h1 className="m-0 text-2xl font-bold text-[var(--mantine-color-text)]">{t('account.title')}</h1>
        <Text c="dimmed" mt={6} size="sm">{t('account.subtitle')}</Text>
      </div>

      <AccountCard title={t('account.identity.title')}>
        <div className="flex items-center gap-4">
          <Avatar color="teal" name={me.user.name} radius="xl" size={56} variant="filled" />
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-base font-semibold text-[var(--mantine-color-text)]">{me.user.name}</p>
            <p className="m-0 mt-0.5 truncate text-sm text-[var(--mantine-color-dimmed)]">{me.user.email}</p>
          </div>
          {role ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--mantine-color-default-border)] bg-[var(--wa-tint)] px-2.5 py-1 text-[11px] font-semibold text-[var(--mantine-color-text)]">
              <ShieldCheckIcon aria-hidden="true" color="var(--wa-accent)" size={11} />
              {t(getRoleLabelKey(role))}
            </span>
          ) : null}
        </div>
      </AccountCard>

      <PersonalDataCard user={me.user} />
      <EmailCard user={me.user} />
      <PasswordCard />
      <SessionsCard />
      <AccessesCard me={me} />

      <AccountCard title={t('account.preferences.title')}>
        <p className="m-0 mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--mantine-color-dimmed)]">{t('theme.label')}</p>
        <div className="max-w-[420px]">
          <ThemePicker size="lg" />
        </div>
        <p className="m-0 mt-2 text-xs text-[var(--mantine-color-dimmed)]">{t('theme.systemHint')}</p>
      </AccountCard>
    </div>
  )
}

/** "Cuentas y accesos": read-only; roles come from /me and are assigned by each account's admin. */
function AccessesCard({ me }: { me: MeResponse }) {
  const { t } = useTranslation('common')

  return (
    <AccountCard
      actions={me.accounts.length > 1 ? <Link className="text-[12.5px] font-semibold text-[var(--wa-teal-text)] no-underline" to="/select-account">{t('shell.changeAccount')}</Link> : null}
      title={t('account.accesses.title')}
    >
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {me.accounts.map((account) => {
          const rows = account.access.locations.length > 0
            ? account.access.locations.map((entry) => ({ key: entry.location_id, name: entry.location_name, role: entry.role }))
            : account.access.account_role
              ? [{ key: 'account', name: t('account.accesses.wholeAccount'), role: account.access.account_role }]
              : []
          return (
            <li key={account.id} className="rounded-xl border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-4 py-3.5">
              <p className="m-0 text-[14.5px] font-semibold text-[var(--mantine-color-text)]">{account.name}</p>
              <ul className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0">
                {rows.map((row) => (
                  <li key={row.key} className="flex items-center gap-2 text-[13px] text-[var(--mantine-color-dimmed)]">
                    <span aria-hidden="true" className="size-[5px] shrink-0 rounded-full bg-[var(--mantine-color-teal-4)]" />
                    <span>
                      {row.name} · <span className="font-semibold text-[var(--mantine-color-text)]">{t(getRoleLabelKey(row.role))}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
      <p className="m-0 mt-3.5 text-[12.5px] leading-relaxed text-[var(--mantine-color-dimmed)]">{t('account.accesses.hint')}</p>
    </AccountCard>
  )
}
