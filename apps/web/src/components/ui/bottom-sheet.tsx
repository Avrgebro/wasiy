import { Button, Drawer, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * The portal's sheet (Portal 02e): rises from the bottom under a dark scrim,
 * grab handle instead of a close button, 20px shoulders, an upward shadow.
 * Header carries the title, up to two dimmed lines and a pill on the right;
 * the footer is a separate zone for the one action the sheet offers. Every
 * sheet stops at 60% of the viewport (the mockups sit under half): header
 * and footer stay put, the body scrolls.
 *
 * Every sheet in the portal uses this: lists (unit switcher), details (visit,
 * reservation), forms (P4) and confirmations (ConfirmSheet below). The
 * handle is visual only; scrim tap and Escape dismiss.
 */
export function BottomSheet({
  children,
  footer,
  lines = [],
  onClose,
  opened,
  pill,
  title,
}: {
  children: ReactNode
  footer?: ReactNode
  /** Dimmed lines under the title: date, unit… */
  lines?: (string | null | undefined)[]
  onClose: () => void
  opened: boolean
  pill?: ReactNode
  title: ReactNode
}) {
  const shown = lines.filter((line): line is string => Boolean(line))

  return (
    <Drawer
      opened={opened}
      overlayProps={{ backgroundOpacity: 0.62, color: '#060e0f' }}
      padding={0}
      position="bottom"
      size="auto"
      styles={{
        content: {
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          borderTop: '1px solid var(--mantine-color-default-border)',
          boxShadow: '0 -18px 44px rgba(0, 0, 0, 0.35)',
          maxHeight: '60dvh',
          display: 'flex',
          flexDirection: 'column',
        },
        // The header is Mantine's (it labels the dialog); we fill it with the
        // handle, the title block and the pill, and let it size to content.
        header: { display: 'block', padding: 0, background: 'transparent', minHeight: 0 },
        title: { display: 'block', width: '100%' },
        body: { padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 },
      }}
      title={
        <>
          <span aria-hidden className="flex justify-center pt-2 pb-0.5">
            <span className="h-1 w-9 rounded-full bg-[var(--mantine-color-default-border)]" />
          </span>
          <span className="flex items-start gap-2.5 px-4 pt-2 pb-2.5">
            <span className="block min-w-0 flex-1">
              <span className="block font-display text-[19px] leading-tight font-semibold tracking-tight text-[var(--mantine-color-text)]">{title}</span>
              {shown.map((line) => (
                <Text key={line} c="dimmed" component="span" display="block" mt={2} size="xs">
                  {line}
                </Text>
              ))}
            </span>
            {pill ? <span className="mt-0.5 shrink-0">{pill}</span> : null}
          </span>
        </>
      }
      withCloseButton={false}
      onClose={onClose}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3.5">{children}</div>

      {footer ? <div className="shrink-0 border-t border-[var(--mantine-color-default-border)] px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{footer}</div> : null}
    </Drawer>
  )
}

/** A footer action with its hint centered underneath ("Puedes cancelar hasta 24 h antes."). */
export function SheetAction({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {children}
      {hint ? (
        <Text c="dimmed" className="text-center" size="xs">
          {hint}
        </Text>
      ) : null}
    </div>
  )
}

/** Filled tiles for facts; two columns unless a tile asks to be wide. */
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
 * A short sheet asking to confirm a destructive step. Stacks on top of the
 * sheet that opened it; the confirm button is red, cancel is plain.
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
        <div className="grid grid-cols-2 gap-2">
          <Button size="md" variant="default" onClick={onCancel}>
            {t('actions.cancel')}
          </Button>
          <Button color="error" loading={pending} size="md" onClick={onConfirm}>
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
