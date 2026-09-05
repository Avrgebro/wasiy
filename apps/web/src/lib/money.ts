/**
 * Whole-sole amounts rendered the way the finance mockup does: "S/ 1 240"
 * with a narrow no-break space as the thousands separator, and a real
 * minus sign ("− S/ 600") for outflows. PEN is the only currency in v1, so
 * the prefix is fixed here and lifted into a parameter when that changes.
 */
export function formatMoney(amount: number, { negative = false }: { negative?: boolean } = {}): string {
  const grouped = Math.abs(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const sign = negative || amount < 0 ? '− ' : ''

  return `${sign}S/ ${grouped}`
}
