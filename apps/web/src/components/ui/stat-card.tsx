type StatCardProps = {
  label: string
  value: string
  detail: string
}

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <section className="rounded-md border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-4">
      <p className="text-sm font-semibold text-[var(--mantine-color-dimmed)]">{label}</p>
      <p className="mt-2 text-2xl font-bold leading-8 text-[var(--mantine-color-text)]">
        {value}
      </p>
      <p className="mt-1 text-sm text-[var(--mantine-color-dimmed)]">{detail}</p>
    </section>
  )
}
