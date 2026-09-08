import { z } from 'zod'

// bcrypt reads at most 72 bytes; the API rejects longer passwords, so the
// form says so before the round-trip (same rule as registration).
const password = z
  .string()
  .min(8, 'validation.passwordTooShort')
  .refine((value) => new TextEncoder().encode(value).length <= 72, 'validation.passwordTooLong')

export const claimInvitationSchema = z
  .object({
    password,
    passwordConfirmation: z.string().min(1, 'validation.passwordConfirmRequired'),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'validation.passwordMismatch',
    path: ['passwordConfirmation'],
  })

export type ClaimInvitationFormValues = z.infer<typeof claimInvitationSchema>

export const createStaffAccountSchema = z
  .object({
    firstName: z.string().trim().min(1, 'validation.firstNameRequired').max(255, 'validation.nameTooLong'),
    lastName: z.string().trim().min(1, 'validation.lastNameRequired').max(255, 'validation.nameTooLong'),
    password,
    passwordConfirmation: z.string().min(1, 'validation.passwordConfirmRequired'),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'validation.passwordMismatch',
    path: ['passwordConfirmation'],
  })

export type CreateStaffAccountFormValues = z.infer<
  typeof createStaffAccountSchema
>
