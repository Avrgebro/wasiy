/**
 * Canonical display label for a unit: "building / number", omitting a
 * missing building name.
 */
export function formatUnitLabel(unit: {
  building_name?: string | null
  unit_number: string
}) {
  return [unit.building_name, unit.unit_number].filter(Boolean).join(' / ')
}
