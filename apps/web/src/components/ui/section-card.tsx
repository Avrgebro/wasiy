import type { ReactNode } from 'react'

/**
 * The card every settings-style page is built from: a header row (title on
 * the left, an action or note on the right), a padded body, and a footer row
 * that pairs a dimmed hint with the card's actions. Same anatomy as the
 * groups on /admin/settings and the location tabs, so pages read alike.
 */
export function SectionCard({
  children,
  className = '',
  footer,
  header,
  headerActions,
  id,
  ref,
  title,
}: {
  children: ReactNode
  className?: string
  /** Hint and/or actions; use `SectionCardFooter` for the hint-left, actions-right layout. */
  footer?: ReactNode
  /** Replaces the default title row when the header is not a plain title. */
  header?: ReactNode
  headerActions?: ReactNode
  id?: string
  ref?: React.Ref<HTMLElement>
  title?: ReactNode
}) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] ${className}`} id={id} ref={ref}>
      {header !== undefined || title !== undefined ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mantine-color-default-border)] px-5 py-4">
          {header ?? <h2 className="m-0 text-sm font-semibold text-[var(--mantine-color-text)]">{title}</h2>}
          {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-4 p-5">{children}</div>
      {footer ? <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-t border-[var(--mantine-color-default-border)] px-5 py-2.5">{footer}</div> : null}
    </section>
  )
}

/** Footer content: the dimmed hint on the left, actions on the right. Either may be omitted. */
export function SectionCardFooter({ actions, hint }: { actions?: ReactNode; hint?: ReactNode }) {
  return (
    <>
      <div className="min-w-0 text-xs text-[var(--mantine-color-dimmed)]">{hint}</div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </>
  )
}
