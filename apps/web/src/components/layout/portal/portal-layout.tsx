import { Button } from '@mantine/core'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Brand } from '../shared/brand'

type PortalLayoutProps = {
  children: ReactNode
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const { t } = useTranslation('common')

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="[&>div]:p-0">
            <Brand />
          </div>
          <nav className="hidden items-center gap-2 md:flex" aria-label={t('shell.mainNav')}>
            <Button component="a" href="/portal/reservations" variant="subtle">
              {t('nav.reservations')}
            </Button>
            <Button component="a" href="/portal/visitors">
              {t('actions.newVisitor')}
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}

