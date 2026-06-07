import type { CancellationCategory } from '@peace-buddy/types'
import { CancellationCategorySchema } from '@peace-buddy/types'

export const CANCEL_CATEGORIES: CancellationCategory[] = [
  CancellationCategorySchema.enum.health,
  CancellationCategorySchema.enum.emergency,
  CancellationCategorySchema.enum.personal,
  CancellationCategorySchema.enum.work,
  CancellationCategorySchema.enum.other,
]
