import { Collapse } from '@mantine/core'
import { AltArrowDown } from '@solar-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LayoutNavCollapsible, LayoutNavItem, LayoutNavLeaf } from './types'

type SidebarItemProps = {
  active: (item: LayoutNavLeaf) => boolean
  item: LayoutNavItem
  onNavigate?: () => void
}

const sidebarItemClassName =
  'flex min-h-10 w-full transform-gpu appearance-none items-center gap-3 rounded-md border-0 bg-transparent px-3 text-left font-sans text-sm font-semibold leading-5 tracking-normal text-[var(--sidebar-foreground)] transition-all duration-150 ease-out hover:translate-x-1 hover:bg-[var(--sidebar-hover)] motion-reduce:transition-none motion-reduce:hover:translate-x-0 data-[active=true]:bg-[var(--sidebar-accent)] data-[active=true]:text-[var(--sidebar-accent-foreground)] data-[active=true]:hover:bg-[var(--sidebar-accent)]'

const sidebarItemLabelClassName =
  'min-w-0 flex-1 font-sans text-sm font-semibold leading-5 tracking-normal'

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
    <a
      aria-current={active ? 'page' : undefined}
      className={`${sidebarItemClassName} data-[nested=true]:min-h-9 data-[nested=true]:bg-transparent data-[nested=true]:pl-10 data-[nested=true]:text-[13px] data-[nested=true]:data-[active=true]:text-[var(--sidebar-active-foreground)] data-[nested=true]:data-[active=true]:hover:bg-[var(--sidebar-hover)]`}
      data-active={active}
      data-nested={nested}
      href={item.to}
      onClick={onNavigate}
    >
      {nested ? null : <Icon aria-hidden="true" size={20} />}
      <span
        className={`${sidebarItemLabelClassName} data-[nested=true]:text-[13px]`}
        data-nested={nested}
      >
        {t(item.labelKey)}
      </span>
    </a>
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
        className={sidebarItemClassName}
        data-active={childIsActive}
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
