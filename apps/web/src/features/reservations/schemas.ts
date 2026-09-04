import { z } from 'zod'

/**
 * URL contract for /admin/reservations. `date` (YYYY-MM-DD) anchors the
 * week to show, defaulting to today's. `status` is the chip, not the raw
 * API status.
 */
export const reservationsSearchSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  status: z.enum(['pending', 'approved', 'completed']).optional().catch(undefined),
  amenity_id: z.string().optional().catch(undefined),
  /** Opens the detail drawer for this booking; deep-linked from Finanzas. */
  reservation: z.string().optional().catch(undefined),
})

export type ReservationsSearchValues = z.infer<typeof reservationsSearchSchema>

/**
 * The Nueva reserva drawer. Shape only — window, capacity, and policy rules
 * live in the API's ValidateReservationSlot, surfaced as field errors.
 */
export const reservationFormSchema = z
  .object({
    amenity_id: z.string().min(1, 'validation.amenityRequired'),
    unit_id: z.string().min(1, 'validation.unitRequired'),
    resident_id: z.string(),
    date: z.string().min(1, 'validation.dateRequired'),
    start: z.string().min(1, 'validation.startRequired'),
    end: z.string().min(1, 'validation.endRequired'),
  })
  .superRefine((values, ctx) => {
    if (values.start && values.end && values.end <= values.start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.endAfterStart',
        path: ['end'],
      })
    }
  })

export type ReservationFormValues = z.infer<typeof reservationFormSchema>
