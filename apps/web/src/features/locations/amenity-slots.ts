/** Slot lengths offered in the amenity form (ADR 0041); the API accepts any multiple of 30 up to 720. */
export const SLOT_MINUTES_OPTIONS = [30, 60, 90, 120, 180, 240, 360, 480, 720] as const

/** "30 min", "2 horas", "1,5 horas" for a slot length. */
export function slotLengthLabel(minutes: number, t: (key: string, options?: Record<string, unknown>) => string) {
  if (minutes < 60) return t('amenities.form.slotMinutes', { count: minutes })
  const hours = minutes / 60

  return Number.isInteger(hours)
    ? t('amenities.form.slotHours', { count: hours })
    : t('amenities.form.slotHoursDecimal', { hours: hours.toFixed(1).replace('.', ',') })
}
