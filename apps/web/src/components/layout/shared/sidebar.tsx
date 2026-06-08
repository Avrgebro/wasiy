import { Button } from '@mantine/core'
import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Brand } from './brand'
import { SidebarItem } from './sidebar-item'
import type { LayoutNavItem } from './types'

type SidebarProps = {
  navItems: LayoutNavItem[]
  productAreaKey: string
}

function isActivePath(pathname: string, to: string) {
  if (to === '/') {
    return pathname === '/'
  }

  return pathname === to || pathname.startsWith(`${to}/`)
}

export function Sidebar({ navItems, productAreaKey }: SidebarProps) {
  const { t } = useTranslation('common')
  const pathname = window.location.pathname

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[var(--border)] bg-[var(--sidebar)] px-3 py-4 lg:block">
      <div className="flex h-full flex-col">
        <Brand productAreaKey={productAreaKey} />
        <nav className="flex flex-1 flex-col gap-1" aria-label={t('shell.mainNav')}>
          {navItems.map((item) => (
            <SidebarItem
              active={isActivePath(pathname, item.to)}
              item={item}
              key={item.to}
              label={t(item.labelKey)}
            />
          ))}
        </nav>
        <Button leftSection={<LogOut size={16} />} variant="subtle">
          {t('auth.logout')}
        </Button>
      </div>
    </aside>
  )
}

