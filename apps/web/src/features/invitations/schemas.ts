import { z } from 'zod'

export const claimInvitationSchema = z
  .object({
    password: z.string().min(8, 'validation.passwordTooShort'),
    passwordConfirmation: z.string().min(1, 'validation.passwordConfirmRequired'),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'validation.passwordMismatch',
    path: ['passwordConfirmation'],
  })

export type ClaimInvitationFormValues = z.infer<typeof claimInvitationSchema>

export const createStaffAccountSchema = z
  .object({
    firstName: z.string().trim().min(1, 'validation.firstNameRequired'),
    lastName: z.string().trim().min(1, 'validation.lastNameRequired'),
    password: z.string().min(8, 'validation.passwordTooShort'),
    passwordConfirmation: z.string().min(1, 'validation.passwordConfirmRequired'),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'validation.passwordMismatch',
    path: ['passwordConfirmation'],
  })

export type CreateStaffAccountFormValues = z.infer<
  typeof createStaffAccountSchema
>
