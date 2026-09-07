import { z } from 'zod'

export const profileSchema = z.object({
  first_name: z.string().trim().min(1, 'validation.firstNameRequired').max(255, 'validation.tooLong'),
  last_name: z.string().trim().min(1, 'validation.lastNameRequired').max(255, 'validation.tooLong'),
})
export type ProfileFormValues = z.infer<typeof profileSchema>

export const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'validation.currentPasswordRequired'),
    password: z.string().min(8, 'validation.passwordMin'),
    password_confirmation: z.string(),
  })
  .refine((values) => values.password === values.password_confirmation, { message: 'validation.passwordMismatch', path: ['password_confirmation'] })
export type PasswordFormValues = z.infer<typeof passwordSchema>

export const emailChangeSchema = z.object({
  current_password: z.string().min(1, 'validation.currentPasswordRequired'),
  email: z.string().trim().toLowerCase().min(1, 'validation.emailRequired').email('validation.emailInvalid'),
})
export type EmailChangeFormValues = z.infer<typeof emailChangeSchema>

export const currentPasswordSchema = z.object({
  current_password: z.string().min(1, 'validation.currentPasswordRequired'),
})
export type CurrentPasswordFormValues = z.infer<typeof currentPasswordSchema>
