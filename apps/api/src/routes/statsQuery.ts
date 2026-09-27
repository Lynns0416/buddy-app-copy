import { z } from 'zod'
import { GroupTypeSchema } from '@peace-buddy/types'

// Tour dates are calendar dates, so the range is `YYYY-MM-DD`, read as UTC
// midnight like the `@db.Date` column it is compared with.
const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((d) => new Date(`${d}T00:00:00.000Z`))
  .refine((d) => !Number.isNaN(d.getTime()))

// The scope shared by the stats endpoints (PRD §11.4).
const statsScopeFields = {
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
  groupType: GroupTypeSchema.optional(),
  placeId: z.string().uuid().optional(),
}

const orderedRange = (q: { from?: Date; to?: Date }) => !q.from || !q.to || q.from <= q.to

export const BuddyStatsQuerySchema = z.object(statsScopeFields).refine(orderedRange)

export const ReflectionStatsQuerySchema = z
  .object({ ...statsScopeFields, tourId: z.string().uuid().optional() })
  .refine(orderedRange)
