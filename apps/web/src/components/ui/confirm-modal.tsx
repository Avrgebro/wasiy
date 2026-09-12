import { Button, Modal, Text } from '@mantine/core'
import { DangerCircleIcon, DangerTriangleIcon, InfoCircleIcon } from '@solar-icons/react/dynamic'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export type ConfirmTone = 'warning' | 'error' | 'info'

const TONE: Record<ConfirmTone, { color: string; icon: ReactNode }> = {
  warning: { color: 'var(--wa-warning)', icon: <DangerTriangleIcon size={20} weight="Bold" /> },
  error: { color: 'var(--wa-error)', icon: <DangerCircleIcon size={20} weight="Bold" /> },
  info: { color: 'var(--wa-info)', icon: <InfoCircleIcon size={20} weight="Bold" /> },
}

/** A label/value row for the facts panel: what the action touches, in numbers. */
export type ConfirmFact = { label: string; value: ReactNode }

/**
 * The confirmation card from mockup 06d: no header bar, a tinted icon chip,
 * a display title, dimmed body, an optional facts panel and warning callout,
 * a closing line, and a footer bar with Cancelar as text, an optional
 * secondary action and the confirming button (destructive by default, as a
 * tinted red). Every yes/no in the app goes through this so they all match.
 */
export function ConfirmModal({
  body,
  callout,
  cancelLabel,
  confirmDisabled = false,
  confirmLabel,
  destructive = true,
  facts,
  footnote,
  loading = false,
  onClose,
  onConfirm,
  opened,
  secondaryAction,
  title,
  tone = 'warning',
}: {
  body: ReactNode
  /** Amber callout under the facts, for a consequence worth a second look. */
  callout?: ReactNode
  cancelLabel?: string
  confirmDisabled?: boolean
  confirmLabel: string
  /** Tinted red button when true (default); accent when the action is not destructive. */
  destructive?: boolean
  facts?: ConfirmFact[]
  footnote?: ReactNode
  /** Keeps the modal open with the confirm button spinning; dismissal is blocked meanwhile. */
  loading?: boolean
  onClose: () => void
  onConfirm: () => void
  opened: boolean
  secondaryAction?: { label: string; onClick: () => void }
  title: string
  tone?: ConfirmTone
}) {
  const { t } = useTranslation('common')
  const { color, icon } = TONE[tone]

  return (
    <Modal
      centered
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      opened={opened}
      radius="lg"
      size={420}
      styles={{ body: { padding: 0 } }}
      withCloseButton={false}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3 px-[22px] pb-[18px] pt-[22px]">
        <span
          aria-hidden
          className="grid size-[38px] place-items-center rounded-[10px]"
          style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
        >
          {icon}
        </span>
        <h2 className="m-0 font-display text-lg font-semibold leading-snug text-[var(--mantine-color-text)]">{title}</h2>
        <Text c="dimmed" className="leading-relaxed" size="sm">
          {body}
        </Text>
        {facts && facts.length > 0 ? (
          <dl className="m-0 flex flex-col gap-[7px] rounded-[10px] bg-[var(--wa-surface-2)] px-3.5 py-3">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-baseline justify-between gap-3 text-sm">
                <dt className="text-[var(--mantine-color-dimmed)]">{fact.label}</dt>
                <dd className="m-0 font-semibold text-[var(--mantine-color-text)]">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {callout ? (
          <div
            className="flex gap-2.5 rounded-[10px] border px-3.5 py-3 text-[12.5px] leading-normal"
            style={{
              background: 'color-mix(in srgb, var(--wa-warning) 14%, transparent)',
              borderColor: 'color-mix(in srgb, var(--wa-warning) 40%, transparent)',
            }}
          >
            <span
              aria-hidden
              className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[11px] font-bold"
              style={{ background: 'var(--wa-warning)', color: 'var(--wa-bg)' }}
            >
              !
            </span>
            <span className="text-[var(--mantine-color-text)]">{callout}</span>
          </div>
        ) : null}
        {footnote ? (
          <Text c="dimmed" className="leading-relaxed" size="sm">
            {footnote}
          </Text>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-[22px] py-3.5">
        <Button disabled={loading} size="sm" variant="subtle" onClick={onClose}>
          {cancelLabel ?? t('actions.cancel')}
        </Button>
        {secondaryAction ? (
          <Button disabled={loading} size="sm" variant="default" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        ) : null}
        <Button
          color={destructive ? 'error' : 'accent'}
          disabled={confirmDisabled}
          loading={loading}
          size="sm"
          variant={destructive ? 'light' : 'filled'}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
