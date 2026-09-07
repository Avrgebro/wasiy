import { AltArrowRightIcon, LogoutIcon, ShieldCheckIcon } from '@solar-icons/react/linear'
import { Avatar, Drawer, Menu, UnstyledButton } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getRoleLabelKey } from '../../../features/auth/access'
import { useLocationContext, useLogout, useMe } from '../../../features/auth/hooks'

/** Same seam as the sidebar's mobile behaviour: below sm the menu is a sheet. */
const BELOW_SM_MEDIA_QUERY = '(max-width: 39.999em)'

/**
 * The account menu behind the topbar avatar (mockup 20, trimmed to two
 * blocks): who you are, which opens Mi cuenta, and the way out. The theme
 * picker lives on Mi cuenta. Desktop anchors a 272px menu to the avatar;
 * phones get a bottom sheet the thumb can reach.
 */
export function UserMenu() {
  const { t } = useTranslation('common')
  const [opened, setOpened] = useState(false)
  const mobile = useMediaQuery(BELOW_SM_MEDIA_QUERY, false, { getInitialValueInEffect: false })
  const me = useMe().data

  const trigger = (
    <UnstyledButton
      aria-expanded={opened}
      aria-haspopup="dialog"
      aria-label={t('shell.userMenu')}
      className="rounded-full ring-[var(--mantine-color-teal-4)] ring-offset-2 ring-offset-[var(--app-canvas)] transition-shadow data-[opened=true]:ring-2"
      data-opened={opened}
      onClick={mobile ? () => setOpened(true) : undefined}
    >
      <Avatar color="teal" name={me?.user.name} radius="xl" size="md" variant="filled" />
    </UnstyledButton>
  )

  if (mobile) {
    return (
      <>
        {trigger}
        <Drawer
          classNames={{ content: '!border-0 !p-0' }}
          onClose={() => setOpened(false)}
          opened={opened}
          overlayProps={{ backgroundOpacity: 0.72, color: 'var(--mantine-color-dark-9)' }}
          padding={0}
          position="bottom"
          radius="20px 20px 0 0"
          size="auto"
          styles={{
            body: { padding: 0 },
            content: {
              background: 'var(--mantine-color-default)',
              borderRadius: '20px 20px 0 0',
              borderTop: '1px solid var(--mantine-color-default-border)',
              height: 'auto',
              maxHeight: '82dvh',
              overflow: 'hidden',
            },
            header: { display: 'none' },
          }}
          title={t('shell.userMenu')}
          withCloseButton={false}
        >
          <span aria-hidden="true" className="flex justify-center pt-2 pb-0.5">
            <span className="h-1 w-[38px] rounded-full bg-[var(--mantine-color-default-border)]" />
          </span>
          <AccountMenuContent compact={false} onDone={() => setOpened(false)} />
        </Drawer>
      </>
    )
  }

  return (
    <Menu
      onChange={setOpened}
      opened={opened}
      position="bottom-end"
      radius={14}
      shadow="0 18px 48px rgba(10, 21, 22, 0.32)"
      styles={{ dropdown: { padding: 0, overflow: 'hidden' } }}
      width={272}
    >
      <Menu.Target>{trigger}</Menu.Target>
      <Menu.Dropdown>
        <AccountMenuContent compact onDone={() => setOpened(false)} />
      </Menu.Dropdown>
    </Menu>
  )
}

/**
 * The two blocks. `compact` is the desktop menu (40px avatar, 40px rows);
 * the sheet gets 48px and 52px so every target suits a thumb.
 */
function AccountMenuContent({ compact, onDone }: { compact: boolean; onDone: () => void }) {
  const { t } = useTranslation('common')
  const router = useRouter()
  const me = useMe().data
  const { currentLocation } = useLocationContext()
  const logoutMutation = useLogout()

  const role =
    me?.roles.account[0]?.role ??
    me?.roles.location.find((assignment) => assignment.location_id === currentLocation?.id)?.role

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        onDone()
        void router.navigate({ to: '/login' })
      },
    })
  }

  return (
    <div className={compact ? '' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]'}>
      <Link
        aria-label={t('account.title')}
        className={`flex items-start gap-3 no-underline transition-colors hover:bg-[var(--mantine-color-default-hover)] ${compact ? 'px-4 py-3.5' : 'px-5 pt-3 pb-3.5'}`}
        onClick={onDone}
        to="/admin/account"
      >
        <Avatar color="teal" name={me?.user.name} radius="xl" size={compact ? 40 : 48} variant="filled" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`truncate font-semibold text-[var(--mantine-color-text)] ${compact ? 'text-sm' : 'font-display text-base tracking-tight'}`}>
            {me?.user.name}
          </span>
          <span className={`truncate text-[var(--mantine-color-dimmed)] ${compact ? 'text-xs' : 'text-[12.5px]'}`}>{me?.user.email}</span>
          {role ? <span className="mt-1"><RolePill label={t(getRoleLabelKey(role))} /></span> : null}
        </div>
        <AltArrowRightIcon aria-hidden="true" className="mt-3 shrink-0 text-[var(--mantine-color-dimmed)]" size={16} />
      </Link>

      <div className={`h-px bg-[var(--mantine-color-default-border)] ${compact ? '' : 'mx-5'}`} />

      <div className={compact ? 'p-2' : 'px-3 pt-2.5'}>
        <button
          className={`flex w-full items-center gap-2.5 border-0 bg-transparent px-2 text-left font-semibold text-[var(--wa-error)] transition-colors hover:bg-[var(--mantine-color-default-hover)] disabled:opacity-60 ${
            compact ? 'h-10 rounded-[9px] text-[13.5px]' : 'h-[52px] rounded-[11px] text-[14.5px]'
          }`}
          disabled={logoutMutation.isPending}
          onClick={handleLogout}
          type="button"
        >
          <LogoutIcon aria-hidden="true" size={compact ? 17 : 19} />
          {t('auth.logout')}
        </button>
      </div>
    </div>
  )
}

function RolePill({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--mantine-color-default-border)] bg-[var(--wa-tint)] px-2.5 py-1 text-[11px] font-semibold text-[var(--mantine-color-text)]">
      <ShieldCheckIcon aria-hidden="true" color="var(--wa-accent)" size={11} />
      {label}
    </span>
  )
}
