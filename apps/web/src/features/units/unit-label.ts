/**
 * The one way a unit is written anywhere it appears inline: "Torre A / 402"
 * when the location has named towers, "402" when it has one unnamed tower.
 * Matches Unit::label() on the API. Returns '' when there is no unit.
 */
export function formatUnitLabel(unit: { building_name?: string | null; unit_number?: string | null } | null | undefined): string {
  if (!unit?.unit_number) return ''

  return [unit.building_name, unit.unit_number].filter(Boolean).join(' / ')
}
