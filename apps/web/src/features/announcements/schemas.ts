import { z } from 'zod'

export const ANNOUNCEMENT_CHIPS = ['active', 'scheduled', 'all'] as const
export type AnnouncementChip = (typeof ANNOUNCEMENT_CHIPS)[number]

/** URL contract for /admin/announcements (mockup 18). Default view: Vigentes. */
export const announcementsSearchSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  search: z.string().catch(''),
  chip: z.enum(ANNOUNCEMENT_CHIPS).catch('active'),
})

export type AnnouncementsSearchValues = z.infer<typeof announcementsSearchSchema>

/**
 * The form drawer (mockup 18b). `mode` decides whether the date and time
 * matter; the API receives one wall-clock string in the location's timezone.
 */
export const announcementFormSchema = z
  .object({
    title: z.string().trim().min(1, 'validation.titleRequired').max(160, 'validation.titleTooLong'),
    body_md: z.string().trim().min(1, 'validation.bodyRequired').max(5000, 'validation.bodyTooLong'),
    is_important: z.boolean(),
    mode: z.enum(['now', 'scheduled']),
    publish_date: z.string(),
    publish_time: z.string(),
    expires_on: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.mode === 'scheduled') {
      if (!values.publish_date) ctx.addIssue({ code: 'custom', path: ['publish_date'], message: 'validation.dateRequired' })
      if (!values.publish_time) ctx.addIssue({ code: 'custom', path: ['publish_time'], message: 'validation.timeRequired' })
    }
  })

export type AnnouncementFormValues = z.infer<typeof announcementFormSchema>
