type StatCardProps = {
  label: string
  value: string
  detail: string
}

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-sm font-semibold text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-2xl font-bold leading-8 text-[var(--foreground)]">
        {value}
      </p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{detail}</p>
    </section>
  )
}
