import { describe, it, expect } from 'vitest'
import {
  getBuddyStatusLabel,
  getTourStatusLabel,
  getBookingStatusLabel,
  buddyStatusBadgeVariant,
  tourStatusBadgeVariant,
  bookingStatusBadgeVariant,
} from './status-display'
import { BuddyStatusSchema, TourStatusSchema, BookingStatusSchema } from '@peace-buddy/types'

const t = (key: string) => key

describe('getBuddyStatusLabel', () => {
  it('returns t(status) for each BuddyStatus', () => {
    for (const s of BuddyStatusSchema.options) {
      expect(getBuddyStatusLabel(t, s)).toBe(s)
    }
  })
})

describe('getTourStatusLabel', () => {
  it('returns t(status) for each TourStatus', () => {
    for (const s of TourStatusSchema.options) {
      expect(getTourStatusLabel(t, s)).toBe(s)
    }
  })
})

describe('getBookingStatusLabel', () => {
  it('returns t(status) for each BookingStatus', () => {
    for (const s of BookingStatusSchema.options) {
      expect(getBookingStatusLabel(t, s)).toBe(s)
    }
  })
})

describe('buddyStatusBadgeVariant', () => {
  it('has an entry for every BuddyStatus', () => {
    for (const s of BuddyStatusSchema.options) {
      expect(buddyStatusBadgeVariant[s]).toBeDefined()
    }
  })
})

describe('tourStatusBadgeVariant', () => {
  it('has an entry for every TourStatus', () => {
    for (const s of TourStatusSchema.options) {
      expect(tourStatusBadgeVariant[s]).toBeDefined()
    }
  })
})

describe('bookingStatusBadgeVariant', () => {
  it('has an entry for every BookingStatus', () => {
    for (const s of BookingStatusSchema.options) {
      expect(bookingStatusBadgeVariant[s]).toBeDefined()
    }
  })
})
