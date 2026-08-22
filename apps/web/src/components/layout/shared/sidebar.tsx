import { ActionIcon, Avatar, Drawer } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { AltArrowLeft, CloseCircle, Logout } from '@solar-icons/react'
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

// Must match Tailwind v4's breakpoints: below `sm` (40em) the Drawer shows
// the full-screen mobile nav; between `sm` and `xl` (80em) the same Drawer
// shows the rail card over an overlay; from `xl` up app-shell's grid pins
// the aside. If either breakpoint is customized, update these literals (and
// the xl media query for --sidebar-width in index.css) or the navs disagree
// at the seams.
const BELOW_SM_MEDIA_QUERY = '(max-width: 39.999em)'
const BELOW_XL_MEDIA_QUERY = '(max-width: 79.999em)'

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
  onClose,
  onNavigate,
}: {
  navItems: LayoutNavEntry[]
  onClose: () => void
  onNavigate?: () => void
}) {
  const { t } = useTranslation('common')

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-[var(--mantine-color-default-border)] bg-[var(--sidebar)] px-3 pb-4 pt-5 shadow-sm">
      <div className="flex items-start justify-between">
        <Brand />
        {/* Only the sm–xl overlay is closable; the pinned rail is not. */}
        <ActionIcon
          aria-label={t('shell.closeNav')}
          className="xl:hidden"
          onClick={onClose}
          radius={10}
          size={40}
          variant="default"
        >
          <AltArrowLeft aria-hidden="true" size={18} />
        </ActionIcon>
      </div>
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
    // h-full, not 100dvh: the Drawer body is already viewport-height, and
    // dvh has misreported the visible height on real devices (see the
    // viewport note in index.css).
    <div className="flex h-full min-h-0 flex-col bg-[var(--sidebar)]">
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
  const isMobile = useMediaQuery(BELOW_SM_MEDIA_QUERY)
  const isOverlay = useMediaQuery(BELOW_XL_MEDIA_QUERY)

  return (
    <>
      {/* One Drawer for every non-pinned width, so Escape, focus trapping,
          scroll locking, and modal semantics come from Mantine in both the
          phone and tablet ranges. Only the dressing differs: full-screen
          mobile nav below sm, the floating rail card over an overlay from
          sm to xl. */}
      {isOverlay ? (
        <Drawer
          classNames={{ content: '!border-0 !p-0' }}
          styles={
            isMobile
              ? {
                  body: {
                    backgroundColor: 'var(--sidebar)',
                    height: '100%',
                    padding: 0,
                  },
                  content: { backgroundColor: 'var(--sidebar)' },
                }
              : {
                  body: { height: '100%', padding: '0.75rem' },
                  content: {
                    backgroundColor: 'transparent',
                    boxShadow: 'none',
                  },
                }
          }
          onClose={onMobileClose}
          opened={mobileOpened}
          padding={0}
          position="left"
          size={isMobile ? '100%' : 'var(--sidebar-width)'}
          withCloseButton={false}
          withOverlay={!isMobile}
        >
          {isMobile ? (
            <MobileSidebarContent
              navItems={navItems}
              onClose={onMobileClose}
              onLocationOpen={onMobileLocationOpen}
            />
          ) : (
            <SidebarContent
              navItems={navItems}
              onClose={onMobileClose}
              onNavigate={onMobileClose}
            />
          )}
        </Drawer>
      ) : null}

      {/* Pinned rail: a plain grid child from xl up. Size it only through
          --sidebar-width (index.css) — the grid column in app-shell reads
          the same variable, so widening the aside directly overlaps the
          content instead of pushing it. */}
      <aside className="hidden h-full w-[var(--sidebar-width)] p-3 xl:block">
        <SidebarContent
          navItems={navItems}
          onClose={onMobileClose}
          onNavigate={onMobileClose}
        />
      </aside>
    </>
  )
}
