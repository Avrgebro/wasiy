export const money = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`
/** Whole soles when the amount has no cents, for headline prices. */
export const moneyShort = (cents: number) => (cents % 100 === 0 ? `S/ ${cents / 100}` : money(cents))

export type PlanPricing = { name: string; price: number; features: string[]; includedUnits: number }

/** Base price covers the included units; every unit beyond costs the unit price. */
export function monthlyTotal(plan: PlanPricing, units: number) {
  const base = plan.price * plan.includedUnits
  const extra = Math.max(0, units - plan.includedUnits)
  return { base, extra, extraCost: extra * plan.price, total: base + extra * plan.price }
}
