import { describe, it, expect } from 'vitest'
import { MY_STATUS_VARIANT, CANCEL_CATEGORIES } from './constants'
import { BookingStatusSchema, CancellationCategorySchema } from '@peace-buddy/types'

describe('MY_STATUS_VARIANT', () => {
  it('has an entry for each BookingStatus', () => {
    expect(MY_STATUS_VARIANT[BookingStatusSchema.enum.confirmed]).toBe('default')
    expect(MY_STATUS_VARIANT[BookingStatusSchema.enum.maybe]).toBe('secondary')
    expect(MY_STATUS_VARIANT[BookingStatusSchema.enum.waitlist]).toBe('outline')
    expect(MY_STATUS_VARIANT[BookingStatusSchema.enum.declined]).toBe('destructive')
  })
})

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
