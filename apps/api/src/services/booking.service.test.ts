/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBooking, updateBooking } from './booking.service'

vi.mock('../lib/db', () => ({
  db: {
    tour: { findUnique: vi.fn() },
    buddyProfile: { findUnique: vi.fn() },
    booking: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { db } from '../lib/db'

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockTourFindUnique = vi.mocked(db.tour).findUnique
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockBuddyFindUnique = vi.mocked(db.buddyProfile).findUnique
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockBookingFindUnique = vi.mocked(db.booking).findUnique
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockBookingCount = vi.mocked(db.booking).count
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockBookingCreate = vi.mocked(db.booking).create
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockBookingFindFirst = vi.mocked(db.booking).findFirst
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockBookingUpdate = vi.mocked(db.booking).update

const futureTour = {
  status: 'published',
  tourDate: new Date('2099-05-01'),
  bookingOpen: true,
  capacity: 10,
}

const mockBuddy = { id: 'buddy-1' }

const mockBookingRow = {
  id: 'booking-1',
  tourId: 'tour-1',
  status: 'confirmed',
  bookedAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

describe('createBooking', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns TOUR_NOT_FOUND when tour does not exist', async () => {
    mockTourFindUnique.mockResolvedValueOnce(null as any)
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    const result = await createBooking('no-tour', 'user-1')
    expect(result).toEqual({ ok: false, code: 'TOUR_NOT_FOUND' })
  })

  it('returns BUDDY_NOT_FOUND when buddy profile does not exist', async () => {
    mockTourFindUnique.mockResolvedValueOnce(futureTour as any)
    mockBuddyFindUnique.mockResolvedValueOnce(null as any)
    const result = await createBooking('tour-1', 'user-no-profile')
    expect(result).toEqual({ ok: false, code: 'BUDDY_NOT_FOUND' })
  })

  it('returns NOT_BOOKABLE when tour status is not published', async () => {
    mockTourFindUnique.mockResolvedValueOnce({ ...futureTour, status: 'draft' } as any)
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    const result = await createBooking('tour-1', 'user-1')
    expect(result).toEqual({ ok: false, code: 'NOT_BOOKABLE' })
  })

  it('returns NOT_BOOKABLE when bookingOpen is false', async () => {
    mockTourFindUnique.mockResolvedValueOnce({ ...futureTour, bookingOpen: false } as any)
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    const result = await createBooking('tour-1', 'user-1')
    expect(result).toEqual({ ok: false, code: 'NOT_BOOKABLE' })
  })

  it('returns NOT_BOOKABLE when tour date is in the past', async () => {
    mockTourFindUnique.mockResolvedValueOnce({ ...futureTour, tourDate: new Date('2000-01-01') } as any)
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    const result = await createBooking('tour-1', 'user-1')
    expect(result).toEqual({ ok: false, code: 'NOT_BOOKABLE' })
  })

  it('returns ALREADY_BOOKED when booking already exists', async () => {
    mockTourFindUnique.mockResolvedValueOnce(futureTour as any)
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    mockBookingFindUnique.mockResolvedValueOnce({ id: 'existing' } as any)
    const result = await createBooking('tour-1', 'user-1')
    expect(result).toEqual({ ok: false, code: 'ALREADY_BOOKED' })
  })

  it('creates booking as confirmed when seats are available', async () => {
    mockTourFindUnique.mockResolvedValueOnce(futureTour as any)
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    mockBookingFindUnique.mockResolvedValueOnce(null as any)
    mockBookingCount.mockResolvedValueOnce(5 as any)
    mockBookingCreate.mockResolvedValueOnce({ ...mockBookingRow, status: 'confirmed' } as any)

    const result = await createBooking('tour-1', 'user-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.booking.status).toBe('confirmed')
      expect(typeof result.booking.bookedAt).toBe('string')
    }
  })

  it('creates booking as waitlist when tour is full', async () => {
    mockTourFindUnique.mockResolvedValueOnce(futureTour as any)
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    mockBookingFindUnique.mockResolvedValueOnce(null as any)
    mockBookingCount.mockResolvedValueOnce(10 as any)
    mockBookingCreate.mockResolvedValueOnce({ ...mockBookingRow, status: 'waitlist' } as any)

    const result = await createBooking('tour-1', 'user-1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.booking.status).toBe('waitlist')
  })

  it('passes buddyId and tourId to booking create', async () => {
    mockTourFindUnique.mockResolvedValueOnce(futureTour as any)
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    mockBookingFindUnique.mockResolvedValueOnce(null as any)
    mockBookingCount.mockResolvedValueOnce(0 as any)
    mockBookingCreate.mockResolvedValueOnce(mockBookingRow as any)

    await createBooking('tour-1', 'user-1')
    const call = mockBookingCreate.mock.calls[0][0] as any
    expect(call.data.buddyId).toBe('buddy-1')
    expect(call.data.tourId).toBe('tour-1')
  })
})

describe('updateBooking', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns BUDDY_NOT_FOUND when buddy profile does not exist', async () => {
    mockBuddyFindUnique.mockResolvedValueOnce(null as any)
    const result = await updateBooking('tour-1', 'user-1', 'declined')
    expect(result).toEqual({ ok: false, code: 'BUDDY_NOT_FOUND' })
  })

  it('returns NOT_FOUND when booking does not exist', async () => {
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    mockBookingFindUnique.mockResolvedValueOnce(null as any)
    const result = await updateBooking('tour-1', 'user-1', 'declined')
    expect(result).toEqual({ ok: false, code: 'NOT_FOUND' })
  })

  it('updates booking status successfully', async () => {
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    mockBookingFindUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'confirmed' } as any)
    mockBookingUpdate.mockResolvedValueOnce({ ...mockBookingRow, status: 'maybe' } as any)

    const result = await updateBooking('tour-1', 'user-1', 'maybe')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.booking.status).toBe('maybe')
  })

  it('returns TOUR_FULL when trying to confirm and tour is at capacity', async () => {
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    mockBookingFindUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'maybe' } as any)
    mockTourFindUnique.mockResolvedValueOnce({ capacity: 10 } as any)
    mockBookingCount.mockResolvedValueOnce(10 as any)

    const result = await updateBooking('tour-1', 'user-1', 'confirmed')
    expect(result).toEqual({ ok: false, code: 'TOUR_FULL' })
  })

  it('allows confirm when seats are available', async () => {
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    mockBookingFindUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'maybe' } as any)
    mockTourFindUnique.mockResolvedValueOnce({ capacity: 10 } as any)
    mockBookingCount.mockResolvedValueOnce(5 as any)
    mockBookingUpdate.mockResolvedValueOnce({ ...mockBookingRow, status: 'confirmed' } as any)

    const result = await updateBooking('tour-1', 'user-1', 'confirmed')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.booking.status).toBe('confirmed')
  })

  it('promotes waitlist when confirmed booking is declined', async () => {
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    mockBookingFindUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'confirmed' } as any)
    mockBookingUpdate.mockResolvedValueOnce({ ...mockBookingRow, status: 'declined' } as any)
    mockTourFindUnique.mockResolvedValueOnce({ capacity: 10 } as any)
    // promoteWaitlist calls: count, findFirst, update
    mockBookingCount.mockResolvedValueOnce(8 as any)
    mockBookingFindFirst.mockResolvedValueOnce({ id: 'waitlist-booking-1' } as any)
    mockBookingUpdate.mockResolvedValueOnce({} as any)

    await updateBooking('tour-1', 'user-1', 'declined')
    expect(mockBookingUpdate).toHaveBeenCalledTimes(2)
    const promoteCall = mockBookingUpdate.mock.calls[1][0] as any
    expect(promoteCall.data.status).toBe('confirmed')
    expect(promoteCall.where.id).toBe('waitlist-booking-1')
  })

  it('does not promote waitlist when maybe booking is declined', async () => {
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    mockBookingFindUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'maybe' } as any)
    mockBookingUpdate.mockResolvedValueOnce({ ...mockBookingRow, status: 'declined' } as any)

    await updateBooking('tour-1', 'user-1', 'declined')
    expect(mockBookingUpdate).toHaveBeenCalledTimes(1)
  })

  it('does not promote waitlist when tour is already full after decline', async () => {
    mockBuddyFindUnique.mockResolvedValueOnce(mockBuddy as any)
    mockBookingFindUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'confirmed' } as any)
    mockBookingUpdate.mockResolvedValueOnce({ ...mockBookingRow, status: 'declined' } as any)
    mockTourFindUnique.mockResolvedValueOnce({ capacity: 10 } as any)
    mockBookingCount.mockResolvedValueOnce(10 as any)

    await updateBooking('tour-1', 'user-1', 'declined')
    expect(mockBookingFindFirst).not.toHaveBeenCalled()
  })
})
