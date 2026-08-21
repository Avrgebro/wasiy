import { ActionIcon, Avatar, Drawer } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { CloseCircle, Logout } from '@solar-icons/react'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { getRoleLabelKey } from '../../../features/auth/access'
import {
  useLocationContext,
  useLogout,
  useMe,
} from '../../../features/auth/hooks'
import { Brand } from './brand'
import {
  LocationSwitcher,
  MobileLocationButton,
} from './location-switcher'
import { isActivePath } from './navigation-state'
import { SidebarItemGroup } from './sidebar-item-group'
import { SidebarItem } from './sidebar-item'
import type { LayoutNavEntry, LayoutNavItem } from './types'

type SidebarProps = {
  mobileOpened: boolean
  navItems: LayoutNavEntry[]
  onMobileClose: () => void
  onMobileLocationOpen: () => void
}

// Must match Tailwind v4's `sm` breakpoint (40em/40rem): below it the Drawer
// nav renders, from it up the `hidden sm:block` aside takes over. If `sm` is
// ever customized, update this literal with it or both navs disagree at the
// seam.
const BELOW_SM_MEDIA_QUERY = '(max-width: 39.999em)'

function isGroup(entry: LayoutNavEntry) {
  return entry.type === 'group'
}

function SidebarItemList({
  items,
  onNavigate,
  pathname,
}: {
  items: LayoutNavItem[]
  onNavigate?: () => void
  pathname: string
}) {
  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <SidebarItem
          active={(item) => isActivePath(pathname, item)}
          item={item}
          key={item.type === 'collapsible' ? item.labelKey : item.to}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  )
}

function SidebarNav({
  navItems,
  onNavigate,
}: {
  navItems: LayoutNavEntry[]
  onNavigate?: () => void
}) {
  const { t } = useTranslation('common')
  // Reactive router state, not window.location: with client-side navigation
  // the document URL updates without a re-render.
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <nav className="flex flex-1 flex-col gap-4" aria-label={t('shell.mainNav')}>
      {navItems.map((entry) => {
        if (isGroup(entry)) {
          return (
            <SidebarItemGroup key={entry.titleKey} title={t(entry.titleKey)}>
              <SidebarItemList
                items={entry.items}
                onNavigate={onNavigate}
                pathname={pathname}
              />
            </SidebarItemGroup>
          )
        }

        return (
          <SidebarItem
            active={(item) => isActivePath(pathname, item)}
            item={entry}
            key={entry.type === 'collapsible' ? entry.labelKey : entry.to}
            onNavigate={onNavigate}
          />
        )
      })}
    </nav>
  )
}

function SidebarContent({
  navItems,
  onNavigate,
}: {
  navItems: LayoutNavEntry[]
  onNavigate?: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-[var(--mantine-color-default-border)] bg-[var(--sidebar)] px-3 pb-4 pt-5 shadow-sm">
      <Brand />
      <div className="pb-4">
        <LocationSwitcher />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <SidebarNav navItems={navItems} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

function MobileAccountFooter() {
  const { t } = useTranslation('common')
  const router = useRouter()
  const meQuery = useMe()
  const logoutMutation = useLogout()
  const me = meQuery.data
  const { currentLocation } = useLocationContext()
  const role =
    me?.roles.account[0]?.role ??
    me?.roles.location.find(
      (assignment) => assignment.location_id === currentLocation?.id,
    )?.role

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => void router.navigate({ to: '/login' }),
    })
  }

  return (
    <div className="flex items-center gap-3 border-t border-[var(--mantine-color-default-border)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <Avatar color="initials" name={me?.user.name} radius="xl" size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--mantine-color-text)]">
          {me?.user.name}
        </p>
        <p className="mt-px truncate text-[11.5px] text-[var(--mantine-color-dimmed)]">
          {role ? t(getRoleLabelKey(role)) : me?.user.email}
        </p>
      </div>
      <button
        className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-semibold text-[var(--mantine-color-dimmed)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--mantine-color-text)] disabled:opacity-60"
        disabled={logoutMutation.isPending}
        onClick={handleLogout}
        type="button"
      >
        <Logout aria-hidden="true" size={15} />
        {t('auth.logout')}
      </button>
    </div>
  )
}

function MobileSidebarContent({
  navItems,
  onClose,
  onLocationOpen,
}: {
  navItems: LayoutNavEntry[]
  onClose: () => void
  onLocationOpen: () => void
}) {
  const { t } = useTranslation('common')

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-[var(--sidebar)]">
      <div className="flex items-center justify-between px-4 py-3.5">
        <Brand className="flex items-center gap-2.5" />
        <ActionIcon
          aria-label={t('shell.closeNav')}
          onClick={onClose}
          radius={10}
          size={40}
          variant="default"
        >
          <CloseCircle aria-hidden="true" size={18} />
        </ActionIcon>
      </div>

      <div className="px-4 pb-4 pt-0.5">
        <MobileLocationButton onClick={onLocationOpen} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <SidebarNav navItems={navItems} onNavigate={onClose} />
      </div>

      <MobileAccountFooter />
    </div>
  )
}

export function Sidebar({
  mobileOpened,
  navItems,
  onMobileClose,
  onMobileLocationOpen,
}: SidebarProps) {
  const { t } = useTranslation('common')
  const isMobile = useMediaQuery(BELOW_SM_MEDIA_QUERY)

  return (
    <>
      {isMobile ? (
        <Drawer
          classNames={{ content: '!border-0 !p-0' }}
          styles={{
            body: {
              backgroundColor: 'var(--sidebar)',
              height: '100%',
              padding: 0,
            },
            content: { backgroundColor: 'var(--sidebar)' },
          }}
          onClose={onMobileClose}
          opened={mobileOpened}
          padding={0}
          position="left"
          size="100%"
          withCloseButton={false}
          withOverlay={false}
        >
          <MobileSidebarContent
            navItems={navItems}
            onClose={onMobileClose}
            onLocationOpen={onMobileLocationOpen}
          />
        </Drawer>
      ) : null}

      {mobileOpened && !isMobile ? (
        <button
          aria-label={t('shell.closeNav')}
          className="fixed inset-0 z-30 hidden border-0 bg-black/40 sm:block lg:hidden"
          onClick={onMobileClose}
          type="button"
        />
      ) : null}

      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] -translate-x-full p-3 transition-transform duration-200 ease-out data-[opened=true]:translate-x-0 sm:block lg:static lg:z-auto lg:h-full lg:translate-x-0"
        data-opened={mobileOpened}
      >
        <SidebarContent navItems={navItems} onNavigate={onMobileClose} />
      </aside>
    </>
  )
}
