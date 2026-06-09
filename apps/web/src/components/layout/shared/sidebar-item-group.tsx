import type { ReactNode } from 'react'

type SidebarItemGroupProps = {
  children: ReactNode
  title: string
}

export function SidebarItemGroup({ children, title }: SidebarItemGroupProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-3 text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
        {title}
      </h2>
      {children}
    </section>
  )
}

