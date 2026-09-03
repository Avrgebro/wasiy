type StatCardProps = {
  label: string
  value: string
  detail: string
  /** Colors the value; omit for the neutral text color. */
  tone?: 'success' | 'error' | 'accent'
  /** Secondary figure rendered after the value ("· S/ 900 en garantía"). */
  aside?: string
  /** Accent border and dot for a tile that needs attention. */
  highlighted?: boolean
}

const toneClasses: Record<NonNullable<StatCardProps['tone']>, string> = {
  success: 'text-[var(--mantine-color-success-light-color)]',
  error: 'text-[var(--mantine-color-error-light-color)]',
  accent: 'text-[var(--mantine-color-accent-light-color)]',
}

export function StatCard({ label, value, detail, tone, aside, highlighted = false }: StatCardProps) {
  return (
    <section
      className={`relative rounded-md border bg-[var(--mantine-color-default)] p-4 ${
        highlighted ? 'border-[var(--wa-accent)]/40' : 'border-[var(--mantine-color-default-border)]'
      }`}
    >
      {highlighted ? (
        <span aria-hidden className="absolute top-4 right-4 size-2 rounded-full bg-[var(--wa-accent)]" />
      ) : null}
      <p className="text-sm font-semibold text-[var(--mantine-color-dimmed)]">{label}</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-2 leading-8">
        <span className={`text-2xl font-bold ${tone ? toneClasses[tone] : 'text-[var(--mantine-color-text)]'}`}>
          {value}
        </span>
        {aside ? <span className="text-sm text-[var(--mantine-color-dimmed)]">{aside}</span> : null}
      </p>
      <p className="mt-1 text-sm text-[var(--mantine-color-dimmed)]">{detail}</p>
    </section>
  )
}
