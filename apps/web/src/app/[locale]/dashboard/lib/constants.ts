import type { BookingStatus, CancellationCategory } from '@peace-buddy/types'
import { BookingStatusSchema, CancellationCategorySchema } from '@peace-buddy/types'

export const MY_STATUS_VARIANT: Record<BookingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  [BookingStatusSchema.enum.confirmed]: 'default',
  [BookingStatusSchema.enum.maybe]: 'secondary',
  [BookingStatusSchema.enum.waitlist]: 'outline',
  [BookingStatusSchema.enum.declined]: 'destructive',
}

export const CANCEL_CATEGORIES: CancellationCategory[] = [
  CancellationCategorySchema.enum.health,
  CancellationCategorySchema.enum.emergency,
  CancellationCategorySchema.enum.personal,
  CancellationCategorySchema.enum.work,
  CancellationCategorySchema.enum.other,
]
