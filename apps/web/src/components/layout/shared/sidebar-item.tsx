import type { LayoutNavItem } from './types'

type SidebarItemProps = {
  active: boolean
  item: LayoutNavItem
  label: string
}

export function SidebarItem({ active, item, label }: SidebarItemProps) {
  const Icon = item.icon

  return (
    <a
      aria-current={active ? 'page' : undefined}
      className="flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold text-[var(--sidebar-foreground)] transition hover:bg-white data-[active=true]:bg-white"
      data-active={active}
      href={item.to}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={2} />
      <span>{label}</span>
    </a>
  )
}

