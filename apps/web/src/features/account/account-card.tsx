import type { ReactNode } from 'react'

/** One block of Mi cuenta (mockup 21): a card with its own title, hint and save. */
export function AccountCard({ children, description, title, actions }: { children: ReactNode; description?: ReactNode; title: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-5">
      {/* Phones stack the action under the title so the hint keeps its width. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="m-0 text-base font-bold text-[var(--mantine-color-text)]">{title}</h2>
          {description ? <p className="mt-1 mb-0 text-sm text-[var(--mantine-color-dimmed)]">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0 [&>button]:w-full sm:[&>button]:w-auto">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** The inline confirmation the mockup uses instead of a toast. */
export function InlineSuccess({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 flex items-center gap-1.5 text-sm text-[var(--wa-success)]" role="status">
      <span aria-hidden="true">✓</span>
      {children}
    </p>
  )
}
