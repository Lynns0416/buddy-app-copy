import { describe, it, expect } from 'vitest'
import { CANCEL_CATEGORIES } from './constants'
import { CancellationCategorySchema } from '@peace-buddy/types'

describe('CANCEL_CATEGORIES', () => {
  it('includes all cancellation categories', () => {
    expect(CANCEL_CATEGORIES).toEqual([
      CancellationCategorySchema.enum.health,
      CancellationCategorySchema.enum.emergency,
      CancellationCategorySchema.enum.personal,
      CancellationCategorySchema.enum.work,
      CancellationCategorySchema.enum.other,
    ])
  })
})
