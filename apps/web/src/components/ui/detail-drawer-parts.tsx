import { Button, Modal, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * The pieces every detail drawer shares (mockups 08 and 10): an uppercase
 * label over a value, a section rule, a vertical timeline, and the confirm
 * step the irreversible actions go through. Keeping them here is what makes
 * the finances and reservations drawers read as one component.
 */
export function DrawerFact({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mantine-color-dimmed)]">
        {label}
      </dt>
      <dd className="m-0 text-sm leading-normal">{value}</dd>
    </div>
  )
}

export function DrawerFacts({ children }: { children: ReactNode }) {
  return <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-4">{children}</dl>
}

/**
 * Drawer spacing scale (UX audit 2026-09-05). AppDrawerBody puts 16px
 * between blocks; a section adds 8px above its header so groups read as
 * 24 / 16, hierarchy stated in space, not only in type. Fields inside a
 * DrawerRow sit 14px apart on wide screens, 16px when stacked.
 *
 * Section header; the optional description says what the section is for once,
 * so the fields under it can drop their own hints and stay aligned.
 */
export function DrawerSection({ label, description }: { label: string; description?: string }) {
  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--wa-interactive)]">{label}</span>
        <span className="h-px flex-1 bg-[var(--mantine-color-default-border)]" />
      </div>
      {description ? <p className="m-0 text-xs leading-relaxed text-[var(--mantine-color-dimmed)]">{description}</p> : null}
    </div>
  )
}

/**
 * A field (or a DrawerRow of fields) with a note under it, for the cases a
 * Mantine `description` cannot cover: a note that spans two fields, or one
 * with a link or a value in it. It replaces the negative-margin dimmed Text
 * the drawers used to pull up under an input.
 */
export function DrawerField({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {children}
      {note ? (
        <Text c="dimmed" size="xs">
          {note}
        </Text>
      ) : null}
    </div>
  )
}

/** Two (or three) fields side by side from the sm breakpoint up, stacked below it. */
export function DrawerRow({ children, className = '', cols = 2 }: { children: ReactNode; className?: string; cols?: 2 | 3 }) {
  return <div className={`grid grid-cols-1 gap-4 sm:gap-3.5 ${cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} ${className}`}>{children}</div>
}

/**
 * The red-bordered block that holds the one destructive action a drawer
 * offers (deactivate, remove). Always last in the body; the button is the
 * only control inside it.
 */
export function DangerZone({ action, description, title }: { action: ReactNode; description: string; title: string }) {
  return (
    <div className="mt-2 flex flex-col gap-3 rounded-inner border border-[var(--wa-error)]/40 p-3.5">
      <div className="min-w-0">
        <Text fw={600} size="sm">
          {title}
        </Text>
        <Text c="dimmed" size="xs">
          {description}
        </Text>
      </div>
      {action}
    </div>
  )
}

export type TimelineItem = {
  id: string
  /** Already formatted "12 ago · 10:14". */
  when: string
  label: string
  actor: string
  /** Something inferred (a completed booking), not an action someone took. */
  derived?: boolean
}

export function DrawerTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {items.map((item, index) => {
        const last = index === items.length - 1

        return (
          <li key={item.id} className="flex gap-3">
            <div className="flex shrink-0 flex-col items-center pt-1">
              <span
                className={`size-2 rounded-full ${
                  item.derived
                    ? 'border border-[var(--mantine-color-dimmed)]'
                    : last
                      ? 'bg-[var(--mantine-color-default-border)]'
                      : 'bg-[var(--wa-interactive)]'
                }`}
              />
              {!last ? <span className="mt-1 -mb-1 w-px flex-1 bg-[var(--mantine-color-default-border)]" /> : null}
            </div>
            <div className={`${last ? '' : 'pb-3.5'} ${item.derived ? 'text-[var(--mantine-color-dimmed)]' : ''}`}>
              <div className="font-mono text-xs text-[var(--wa-text-3)]">{item.when}</div>
              <div className="mt-0.5 text-[13px] font-medium">{item.label}</div>
              <div className="text-xs text-[var(--mantine-color-dimmed)]">{item.actor}</div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function ConfirmDialog({
  body,
  loading = false,
  onCancel,
  onConfirm,
  opened,
  title,
}: {
  body: string
  /** Keeps the dialog open with the confirm button spinning while the action runs. */
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
  opened: boolean
  title: string
}) {
  const { t } = useTranslation('common')

  return (
    <Modal centered closeOnClickOutside={!loading} closeOnEscape={!loading} opened={opened} radius="lg" title={title} withCloseButton={!loading} onClose={onCancel}>
      <Text size="sm">{body}</Text>
      <div className="mt-4 flex justify-end gap-2">
        <Button disabled={loading} variant="default" onClick={onCancel}>
          {t('actions.cancel')}
        </Button>
        <Button color="error" loading={loading} onClick={onConfirm}>
          {t('actions.confirm')}
        </Button>
      </div>
    </Modal>
  )
}
