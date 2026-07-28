import { Collapse } from '@mantine/core'
import { AltArrowDown } from '@solar-icons/react'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LayoutNavCollapsible, LayoutNavItem, LayoutNavLeaf } from './types'

type SidebarItemProps = {
  active: (item: LayoutNavLeaf) => boolean
  item: LayoutNavItem
  onNavigate?: () => void
}

const sidebarItemBaseClassName =
  'flex w-full transform-gpu appearance-none items-center gap-3 rounded-md border-0 px-3 text-left font-sans text-sm font-semibold leading-5 tracking-normal transition-all duration-150 ease-out hover:translate-x-1 motion-reduce:transition-none motion-reduce:hover:translate-x-0'

// Class lists are computed from state instead of stacked data-attribute
// variants: with data-[nested]/data-[active] overrides the winner depends on
// generated CSS order, which made the active subitem style silently lose.
function sidebarItemClassName({
  active,
  nested = false,
}: {
  active: boolean
  nested?: boolean
}) {
  return [
    sidebarItemBaseClassName,
    nested ? 'min-h-9 pl-10' : 'min-h-10',
    active
      ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] hover:bg-[var(--sidebar-accent)]'
      : 'bg-transparent text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-hover)]',
  ].join(' ')
}

const sidebarItemLabelClassName =
  'min-w-0 flex-1 font-sans font-semibold leading-5 tracking-normal'

function SidebarLink({
  active,
  item,
  nested = false,
  onNavigate,
}: {
  active: boolean
  item: LayoutNavLeaf
  nested?: boolean
  onNavigate?: () => void
}) {
  const { t } = useTranslation('common')
  const Icon = item.icon

  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={sidebarItemClassName({ active, nested })}
      to={item.to}
      onClick={onNavigate}
    >
      {nested ? null : <Icon aria-hidden="true" size={20} />}
      <span className={sidebarItemLabelClassName}>{t(item.labelKey)}</span>
    </Link>
  )
}

export function SidebarItem({ active, item, onNavigate }: SidebarItemProps) {
  if (item.type !== 'collapsible') {
    return (
      <SidebarLink
        active={active(item)}
        item={item}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <SidebarCollapsibleItem
      active={active}
      item={item}
      onNavigate={onNavigate}
    />
  )
}

function SidebarCollapsibleItem({
  active,
  item,
  onNavigate,
}: {
  active: (item: LayoutNavLeaf) => boolean
  item: LayoutNavCollapsible
  onNavigate?: () => void
}) {
  const { t } = useTranslation('common')
  const Icon = item.icon
  const childIsActive = item.children.some((child) => active(child))
  const [opened, setOpened] = useState(item.defaultOpen ?? childIsActive)

  return (
    <div>
      <button
        aria-expanded={opened}
        className={sidebarItemClassName({ active: childIsActive && !opened })}
        onClick={() => setOpened((current) => !current)}
        type="button"
      >
        <Icon aria-hidden="true" size={20} />
        <span className={sidebarItemLabelClassName}>{t(item.labelKey)}</span>
        <AltArrowDown
          aria-hidden="true"
          className="shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none data-[opened=true]:rotate-180"
          data-opened={opened}
          size={16}
        />
      </button>

      <Collapse
        animateOpacity
        expanded={opened}
        transitionDuration={220}
        transitionTimingFunction="cubic-bezier(0.16, 1, 0.3, 1)"
      >
        <div className="mt-1 flex flex-col gap-1">
          {item.children.map((child) => (
            <SidebarLink
              active={active(child)}
              item={child}
              key={child.to}
              nested
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </Collapse>
    </div>
  )
}
