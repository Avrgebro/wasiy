import type { ReactNode } from 'react'

export type QuickFilterOption<K extends string> = {
  key: K
  label: ReactNode
  /** Shown after the label for work-queue views (En recepción, Dentro, Pendientes…); never on "Todos". */
  count?: number
}

/**
 * The row of exclusive quick views above a table: "Todos" first, then the
 * three or four questions the desk asks every day. Anything that only
 * describes a record's state belongs behind Filtros instead (UX audit
 * 2026-09-05). The active pill is a strong neutral on the interactive
 * tint; the page's amber stays reserved for its one primary action.
 */
export function QuickFilters<K extends string>({
  label,
  onChange,
  options,
  value,
}: {
  /** Accessible name for the group. */
  label: string
  onChange: (key: K) => void
  options: QuickFilterOption<K>[]
  value: K
}) {
  return (
    <div aria-label={label} className="flex items-center gap-2 overflow-x-auto pointer-coarse:gap-3 max-sm:pr-6 max-sm:[scrollbar-width:none] sm:flex-wrap sm:overflow-visible" role="group">
      {options.map((option) => {
        const active = option.key === value

        return (
          <button
            key={option.key}
            aria-pressed={active}
            className={`shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-[15px] py-[7px] text-xs font-semibold transition-colors pointer-coarse:min-h-11 pointer-coarse:px-5 ${
              active
                ? 'border-[var(--wa-interactive)] bg-[var(--wa-tint-selected)] text-[var(--wa-teal-text)]'
                : 'border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] text-[var(--mantine-color-dimmed)] hover:border-[var(--wa-border-strong)]'
            }`}
            type="button"
            onClick={() => onChange(option.key)}
          >
            {option.label}
            {option.count !== undefined ? (
              <>
                {' '}
                <span className={`tabular-nums ${active ? 'opacity-70' : ''}`}>{option.count}</span>
              </>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
