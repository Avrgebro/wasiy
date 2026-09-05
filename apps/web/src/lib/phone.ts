import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'

export const FALLBACK_COUNTRY: CountryCode = 'PE'

export function asCountryCode(value: string | null | undefined): CountryCode {
  const upper = (value ?? '').toUpperCase()
  return (getCountries() as string[]).includes(upper) ? (upper as CountryCode) : FALLBACK_COUNTRY
}

/**
 * Phones are stored in E.164. Shown nationally when the number belongs to the
 * viewer's country ("987 654 321"), internationally otherwise ("+56 9 8765 4321").
 * Anything that fails to parse (legacy text) is shown as stored.
 */
export function formatPhone(e164: string | null | undefined, viewerCountry: string | null | undefined): string {
  if (!e164) return ''
  const parsed = parsePhoneNumberFromString(e164)
  if (!parsed) return e164

  return parsed.country === asCountryCode(viewerCountry) ? parsed.formatNational() : parsed.formatInternational()
}

/** The tel: target; E.164 needs no cleanup, legacy text loses its spaces. */
export function telHref(e164: string): string {
  return `tel:${e164.replace(/\s+/g, '')}`
}

/** "🇵🇪" from "PE": regional indicator symbols. */
export function countryFlag(country: string): string {
  return country
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
}

const regionNames = new Intl.DisplayNames(['es'], { type: 'region' })

export type CountryOption = { value: CountryCode; label: string; callingCode: string; name: string }

let cachedOptions: CountryOption[] | null = null

/** Every dialable country, Spanish name, sorted by name. Built once. */
export function countryOptions(): CountryOption[] {
  if (cachedOptions) return cachedOptions
  cachedOptions = getCountries()
    .map((code) => {
      const name = regionNames.of(code) ?? code
      const callingCode = getCountryCallingCode(code)

      return { value: code, name, callingCode, label: `${countryFlag(code)} +${callingCode} ${name}` }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return cachedOptions
}

/** What the user typed, formatted as they go, for the given country. */
export function formatAsYouType(national: string, country: CountryCode): string {
  return new AsYouType(country).input(national)
}

/** E.164 for a national number in a country; a raw "+digits" fallback keeps partial input round-tripping. */
export function toE164(national: string, country: CountryCode): string {
  const digits = national.replace(/\D+/g, '')
  if (digits === '') return ''
  const parsed = parsePhoneNumberFromString(national, country)

  return parsed?.number ?? `+${getCountryCallingCode(country)}${digits}`
}

/** Split a stored value back into the selector's country and the national digits. */
export function fromE164(value: string, fallback: CountryCode): { country: CountryCode; national: string } {
  if (!value) return { country: fallback, national: '' }
  const parsed = parsePhoneNumberFromString(value)
  if (parsed?.country) return { country: parsed.country, national: parsed.formatNational() }

  return { country: fallback, national: value }
}
