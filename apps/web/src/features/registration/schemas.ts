import { z } from 'zod'
import { registrationCountries, type CountryCode } from './api'

/** Field names mirror the API payload so Laravel 422 errors land on the right input. */
export const accountSchema = z
  .object({
    first_name: z.string().trim().min(1, 'validation.firstNameRequired').max(100, 'validation.tooLong'),
    last_name: z.string().trim().min(1, 'validation.lastNameRequired').max(100, 'validation.tooLong'),
    email: z.string().trim().toLowerCase().min(1, 'validation.emailRequired').email('validation.emailInvalid')
      .refine(value => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value), 'validation.emailInvalid'),
    password: z.string().min(8, 'validation.passwordTooShort')
      // bcrypt truncates at 72 bytes; the backend enforces the same limit.
      .refine(value => new TextEncoder().encode(value).length <= 72, 'validation.passwordTooLong'),
    password_confirmation: z.string().min(1, 'validation.passwordConfirmRequired'),
    terms_accepted: z.boolean().refine(value => value, 'validation.termsRequired'),
  })
  .refine(values => values.password === values.password_confirmation, { message: 'validation.passwordMismatch', path: ['password_confirmation'] })

export type AccountFormValues = z.infer<typeof accountSchema>

const countryCodes = registrationCountries.map(country => country.value) as [CountryCode, ...CountryCode[]]

export const buildingSchema = z.object({
  name: z.string().trim().min(1, 'validation.buildingNameRequired').max(150, 'validation.tooLong'),
  address: z.string().trim().min(1, 'validation.addressLine1Required').max(255, 'validation.tooLong'),
  district: z.string().trim().min(1, 'validation.districtRequired').max(255, 'validation.tooLong'),
  city: z.string().trim().min(1, 'validation.cityRequired').max(255, 'validation.tooLong'),
  country: z.enum(countryCodes, { error: 'validation.countryRequired' }),
  // Mantine's NumberInput reports '' while empty; the output is always a number.
  units: z.union([z.literal(''), z.number()]).transform((value, ctx) => {
    if (value === '') {
      ctx.addIssue({ code: 'custom', message: 'validation.unitsRequired' })
      return z.NEVER
    }
    if (!Number.isInteger(value) || value < 1 || value > 10000) {
      ctx.addIssue({ code: 'custom', message: 'validation.unitsRange' })
      return z.NEVER
    }
    return value
  }),
})

export type BuildingFormInput = z.input<typeof buildingSchema>
export type BuildingFormValues = z.output<typeof buildingSchema>
