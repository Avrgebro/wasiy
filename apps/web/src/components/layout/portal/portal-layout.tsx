import { Button } from '@mantine/core'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Brand } from '../shared/brand'
import { ColorSchemeToggle } from '../shared/color-scheme-toggle'
import type { LayoutNavLeaf } from '../shared/types'

type PortalLayoutProps = {
  children: ReactNode
  navItems: LayoutNavLeaf[]
}

export function PortalLayout({ children, navItems }: PortalLayoutProps) {
  const { t } = useTranslation('common')

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="[&>div]:p-0">
            <Brand />
          </div>
          <div className="flex items-center gap-2">
            <nav
              className="hidden items-center gap-2 md:flex"
              aria-label={t('shell.mainNav')}
            >
              {navItems.map((item) => (
                <Button component="a" href={item.to} key={item.to} variant="subtle">
                  {t(item.labelKey)}
                </Button>
              ))}
            </nav>
            <ColorSchemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
