/**
 * Amounts travel as integer cents (minor units) and render the way the
 * finance mockup does: "S/ 1 240" when the cents are zero, "S/ 1 240.50"
 * otherwise, with a narrow no-break space as the thousands separator and a
 * real minus sign ("− S/ 600") for outflows. PEN is the only currency in
 * v1, so the prefix is fixed here and lifted into a parameter when that
 * changes.
 */
export function formatMoney(minor: number, { negative = false }: { negative?: boolean } = {}): string {
  const cents = Math.round(Math.abs(minor))
  const whole = Math.floor(cents / 100)
  const fraction = cents % 100
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const decimals = fraction === 0 ? '' : `.${fraction.toString().padStart(2, '0')}`
  const sign = negative || minor < 0 ? '− ' : ''

  return `${sign}S/ ${grouped}${decimals}`
}
