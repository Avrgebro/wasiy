import type { ReactNode } from 'react'

type SidebarItemGroupProps = {
  children: ReactNode
  title: string
}

export function SidebarItemGroup({ children, title }: SidebarItemGroupProps) {
  return (
    <section className="flex flex-col gap-2.5 sm:gap-2">
      <h2 className="px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--mantine-color-dimmed)] sm:px-3 sm:text-xs sm:tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  )
}
