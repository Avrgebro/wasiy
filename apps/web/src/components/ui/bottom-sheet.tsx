import { Button, Drawer, Text, UnstyledButton } from '@mantine/core'
import { CloseIcon } from '@solar-icons/react/linear'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * The portal's sheet (Portal 02e, 04c–04e): rises from the bottom under a
 * dark scrim inside the same 30rem column as the page, grab handle, 20px
 * shoulders, one 16px inset, 11px between blocks. Content-sized, capped at
 * 60% of the viewport; header and footer stay while the body scrolls.
 *
 * Header: title, up to two dimmed lines, and either a `pill` (detail
 * sheets) or a small close square (`withClose`, form sheets). Footer: the
 * sheet's actions; `footerDivider` draws the line the detail sheet has and
 * the form sheets do not.
 */
export function BottomSheet({
  children,
  footer,
  footerDivider = false,
  leading,
  lines = [],
  onClose,
  opened,
  pill,
  title,
  withClose = false,
}: {
  children: ReactNode
  footer?: ReactNode
  footerDivider?: boolean
  /** An avatar or icon before the title (04d). */
  leading?: ReactNode
  /** Dimmed lines under the title: date, unit… */
  lines?: (string | null | undefined)[]
  onClose: () => void
  opened: boolean
  pill?: ReactNode
  title: ReactNode
  withClose?: boolean
}) {
  const { t } = useTranslation('common')
  const shown = lines.filter((line): line is string => Boolean(line))

  return (
    <Drawer
      opened={opened}
      overlayProps={{ backgroundOpacity: 0.42, color: '#1c2b2c' }}
      padding={0}
      position="bottom"
      styles={{
        inner: { justifyContent: 'center' },
        content: {
          // Mantine maps size="auto" to a non-existent --drawer-size-auto, so
          // the height rule is stated here: content-sized, capped at 60dvh.
          height: 'auto',
          flex: '0 0 auto',
          width: '100%',
          maxWidth: '30rem',
          overflow: 'hidden',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          borderTop: '1px solid var(--mantine-color-default-border)',
          boxShadow: '0 -18px 44px rgba(28, 43, 44, 0.22)',
          maxHeight: '60dvh',
          display: 'flex',
          flexDirection: 'column',
        },
        header: { display: 'block', padding: 0, background: 'transparent', minHeight: 0 },
        title: { display: 'block', width: '100%' },
        body: { padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 },
      }}
      title={
        <>
          <span aria-hidden className="flex justify-center pt-2 pb-0.5">
            <span className="h-1 w-9 rounded-full bg-[var(--mantine-color-default-border)]" />
          </span>
          <span className="flex items-start gap-2.5 px-4 pt-2.5">
            {leading ? <span className="shrink-0">{leading}</span> : null}
            <span className="block min-w-0 flex-1">
              <span className="block font-display text-[17px] leading-tight font-semibold tracking-tight text-[var(--mantine-color-text)]">{title}</span>
              {shown.map((line) => (
                <Text key={line} c="dimmed" component="span" display="block" mt={3} size="xs">
                  {line}
                </Text>
              ))}
            </span>
            {pill ? <span className="mt-0.5 shrink-0">{pill}</span> : null}
            {withClose && !pill ? (
              <UnstyledButton aria-label={t('actions.close')} className="grid size-7 shrink-0 place-items-center rounded-lg border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] text-[var(--mantine-color-dimmed)]" onClick={onClose}>
                <CloseIcon size={16} />
              </UnstyledButton>
            ) : null}
          </span>
        </>
      }
      withCloseButton={false}
      onClose={onClose}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-[11px] pb-5">{children}</div>

      {footer ? (
        <div className={`shrink-0 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] ${footerDivider ? 'mt-0 border-t border-[var(--mantine-color-default-border)] pt-3.5' : '-mt-2 pt-0'}`}>{footer}</div>
      ) : null}
    </Drawer>
  )
}

/** The sheet's actions stacked 11px apart, with an optional centered hint under them. */
export function SheetAction({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-[11px]">
      {children}
      {hint ? (
        <Text c="dimmed" className="text-center leading-normal" size="xs">
          {hint}
        </Text>
      ) : null}
    </div>
  )
}

/** Filled tiles for facts (02e); two columns unless a tile asks to be wide. */
export function SheetTiles({ children }: { children: ReactNode }) {
  return <dl className="m-0 grid grid-cols-2 gap-1.5">{children}</dl>
}

export function SheetTile({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-inner bg-[var(--wa-surface-2)] px-3 py-2 ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--mantine-color-dimmed)]">{label}</dt>
      <dd className="m-0 mt-0.5 text-[13.5px] leading-snug font-semibold">{value}</dd>
    </div>
  )
}

/** A key–value row (04d): label on the left, value right-aligned, bordered card. */
export function SheetRows({ children }: { children: ReactNode }) {
  return <dl className="m-0 flex flex-col gap-1.5">{children}</dl>
}

export function SheetRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] px-3 py-2.5">
      <dt className="shrink-0 text-[12.5px] text-[var(--mantine-color-dimmed)]">{label}</dt>
      <dd className="m-0 min-w-0 flex-1 text-right text-[13px] font-semibold">{value}</dd>
    </div>
  )
}

/** The tinted note ("Nota de administración"): a small "i" circle and a colored uppercase label over the text. */
export function SheetNote({ children, label, tone = 'info' }: { children: ReactNode; label: string; tone?: 'info' | 'warning' | 'error' }) {
  const color = `var(--wa-${tone})`

  return (
    <div className="rounded-inner bg-[var(--wa-surface-2)] px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span aria-hidden className="grid size-[15px] place-items-center rounded-full text-[10px] font-bold" style={{ color, backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` }}>
          i
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color }}>
          {label}
        </span>
      </div>
      <Text className="mt-1 leading-snug" size="sm">
        {children}
      </Text>
    </div>
  )
}

/**
 * A short sheet asking to confirm a destructive step (04d′). Stacks on the
 * sheet that opened it; red filled confirm beside a plain cancel, 44px.
 */
export function ConfirmSheet({
  body,
  confirmLabel,
  onCancel,
  onConfirm,
  opened,
  pending = false,
  title,
}: {
  body: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
  opened: boolean
  pending?: boolean
  title: string
}) {
  const { t } = useTranslation('common')

  return (
    <BottomSheet
      footer={
        <div className="grid grid-cols-2 gap-2.5">
          <Button h={44} variant="default" onClick={onCancel}>
            {t('actions.cancel')}
          </Button>
          <Button color="error" h={44} loading={pending} onClick={onConfirm}>
            {confirmLabel ?? t('actions.confirm')}
          </Button>
        </div>
      }
      opened={opened}
      title={title}
      onClose={onCancel}
    >
      <Text size="sm">{body}</Text>
    </BottomSheet>
  )
}
