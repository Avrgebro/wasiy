import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'validation.emailRequired')
    .email('validation.emailInvalid'),
  password: z.string().min(1, 'validation.passwordRequired'),
  // Fortify reads `remember` from the login request and issues the long-lived
  // remember cookie when it is true. The form defaults it to checked.
  remember: z.boolean(),
})

export type LoginFormValues = z.infer<typeof loginSchema>
