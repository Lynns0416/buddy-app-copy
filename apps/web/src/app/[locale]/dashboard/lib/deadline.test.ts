import { describe, it, expect } from 'vitest'
import { isPastDeadline, canSelectMaybeStatus, isBookingAllowed } from './deadline'
import { TourStatusSchema } from '@peace-buddy/types'

describe('isPastDeadline', () => {
  it('returns true when today equals deadline', () => {
    expect(isPastDeadline('2025-03-15', '2025-03-15T00:00:00Z')).toBe(true)
  })

  it('returns true when today is after deadline', () => {
    expect(isPastDeadline('2025-03-16', '2025-03-15T00:00:00Z')).toBe(true)
  })

  it('returns false when today is before deadline', () => {
    expect(isPastDeadline('2025-03-14', '2025-03-15T00:00:00Z')).toBe(false)
  })
})

describe('canSelectMaybeStatus', () => {
  it('returns true when both deadlines are in the future', () => {
    expect(canSelectMaybeStatus(false, false)).toBe(true)
  })

  it('returns false when maybe deadline is past', () => {
    expect(canSelectMaybeStatus(true, false)).toBe(false)
  })

  it('returns false when cancellation deadline is past', () => {
    expect(canSelectMaybeStatus(false, true)).toBe(false)
  })

  it('returns false when both deadlines are past', () => {
    expect(canSelectMaybeStatus(true, true)).toBe(false)
  })
})

describe('isBookingAllowed', () => {
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  it('returns true when tour is published, booking open, and date is in future', () => {
    expect(isBookingAllowed(TourStatusSchema.enum.published, true, futureDate)).toBe(true)
  })

  it('returns false when tour status is not published', () => {
    expect(isBookingAllowed(TourStatusSchema.enum.draft, true, futureDate)).toBe(false)
    expect(isBookingAllowed(TourStatusSchema.enum.cancelled, true, futureDate)).toBe(false)
    expect(isBookingAllowed(TourStatusSchema.enum.completed, true, futureDate)).toBe(false)
  })

  it('returns false when booking is not open', () => {
    expect(isBookingAllowed(TourStatusSchema.enum.published, false, futureDate)).toBe(false)
  })

  it('returns false when tour date is in the past', () => {
    expect(isBookingAllowed(TourStatusSchema.enum.published, true, pastDate)).toBe(false)
  })
})
