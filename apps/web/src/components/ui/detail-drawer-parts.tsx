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

export function DrawerSection({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--wa-interactive)]">{label}</span>
      <span className="h-px flex-1 bg-[var(--mantine-color-default-border)]" />
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
              <div className="font-mono text-xs text-[var(--mantine-color-dimmed)]">{item.when}</div>
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
  onCancel,
  onConfirm,
  opened,
  title,
}: {
  body: string
  onCancel: () => void
  onConfirm: () => void
  opened: boolean
  title: string
}) {
  const { t } = useTranslation('common')

  return (
    <Modal centered opened={opened} radius="lg" title={title} onClose={onCancel}>
      <Text size="sm">{body}</Text>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="default" onClick={onCancel}>
          {t('actions.cancel')}
        </Button>
        <Button color="error" onClick={onConfirm}>
          {t('actions.confirm')}
        </Button>
      </div>
    </Modal>
  )
}
