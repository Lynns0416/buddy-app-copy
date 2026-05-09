import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { createBooking, updateBooking } from './booking.service'

type MockFn = Mock<(...args: unknown[]) => unknown>
interface MockDb {
  tour: { findUnique: MockFn }
  buddyProfile: { findUnique: MockFn }
  tierCapacity: { findMany: MockFn }
  booking: { findUnique: MockFn; count: MockFn; create: MockFn; findFirst: MockFn; update: MockFn }
  buddyCancellationDeadlineOverride: { findUnique: MockFn }
  cancellationReason: { create: MockFn }
  $transaction: MockFn
}

vi.mock('../lib/db', () => {
  const $transaction = vi.fn()
  const mockDb = {
    tour: { findUnique: vi.fn() },
    buddyProfile: { findUnique: vi.fn() },
    tierCapacity: { findMany: vi.fn() },
    booking: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    buddyCancellationDeadlineOverride: { findUnique: vi.fn() },
    cancellationReason: { create: vi.fn() },
    $transaction,
  }
  $transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(mockDb))
  return { db: mockDb }
})

import { db } from '../lib/db'
const mdb = db as unknown as MockDb

// Typed wrapper: expect.objectContaining returns `any` in this Vitest version
function oc<T extends Record<string, unknown>>(v: T): T {
  return expect.objectContaining(v) as unknown as T
}

const futureTour = {
  status: 'published',
  tourDate: new Date('2099-05-01'),
  bookingOpen: true,
  capacity: 10,
}

const futureTourWithDeadline = {
  cancellationDeadline: new Date('2099-01-01'),
  maybeDeadline: null as Date | null,
  capacity: 10,
}

const mockBuddy = { id: 'buddy-1', tier: 'junior', status: 'active' }

const mockBookingRow = {
  id: 'booking-1',
  tourId: 'tour-1',
  buddyTier: 'junior',
  status: 'confirmed',
  bookedAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

const mockReason = { category: 'health' as const, unavoidable: false }

describe('createBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns TOUR_NOT_FOUND when tour does not exist', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(null)
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    const result = await createBooking('no-tour', 'user-1')
    expect(result).toEqual({ ok: false, code: 'TOUR_NOT_FOUND' })
  })

  it('returns BUDDY_NOT_FOUND when buddy profile does not exist', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(futureTour)
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(null)
    const result = await createBooking('tour-1', 'user-no-profile')
    expect(result).toEqual({ ok: false, code: 'BUDDY_NOT_FOUND' })
  })

  it('returns NOT_BOOKABLE when tour status is not published', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce({ ...futureTour, status: 'draft' })
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    const result = await createBooking('tour-1', 'user-1')
    expect(result).toEqual({ ok: false, code: 'NOT_BOOKABLE' })
  })

  it('returns NOT_BOOKABLE when bookingOpen is false', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce({ ...futureTour, bookingOpen: false })
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    const result = await createBooking('tour-1', 'user-1')
    expect(result).toEqual({ ok: false, code: 'NOT_BOOKABLE' })
  })

  it('returns NOT_BOOKABLE when tour date is in the past', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce({ ...futureTour, tourDate: new Date('2000-01-01') })
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    const result = await createBooking('tour-1', 'user-1')
    expect(result).toEqual({ ok: false, code: 'NOT_BOOKABLE' })
  })

  it('returns NOT_ELIGIBLE when buddy is not active', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(futureTour)
    mdb.buddyProfile.findUnique.mockResolvedValueOnce({ ...mockBuddy, status: 'pending' })
    const result = await createBooking('tour-1', 'user-1')
    expect(result).toEqual({ ok: false, code: 'NOT_ELIGIBLE' })
  })

  it('returns NOT_ELIGIBLE when buddy status is trainee', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(futureTour)
    mdb.buddyProfile.findUnique.mockResolvedValueOnce({ ...mockBuddy, status: 'trainee', tier: null })
    const result = await createBooking('tour-1', 'user-1')
    expect(result).toEqual({ ok: false, code: 'NOT_ELIGIBLE' })
  })

  it('returns ALREADY_BOOKED when booking already exists and is not declined', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(futureTour)
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    mdb.booking.count.mockResolvedValueOnce(0) // primaryCount
    mdb.booking.count.mockResolvedValueOnce(0) // otherCount
    mdb.booking.count.mockResolvedValueOnce(0) // totalConfirmed
    mdb.booking.findUnique.mockResolvedValueOnce({ id: 'existing', status: 'confirmed' })
    const result = await createBooking('tour-1', 'user-1')
    expect(result).toEqual({ ok: false, code: 'ALREADY_BOOKED' })
  })

  it('re-books a previously declined booking', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(futureTour)
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    mdb.booking.count.mockResolvedValueOnce(0) // primaryCount
    mdb.booking.count.mockResolvedValueOnce(0) // otherCount
    mdb.booking.count.mockResolvedValueOnce(0) // totalConfirmed
    mdb.booking.findUnique.mockResolvedValueOnce({ id: 'existing', status: 'declined' })
    mdb.booking.update.mockResolvedValueOnce({ ...mockBookingRow, status: 'confirmed' })

    const result = await createBooking('tour-1', 'user-1')
    expect(result.ok).toBe(true)
    expect(mdb.booking.update).toHaveBeenCalledWith(
      oc({ where: oc({ id: 'existing' }) })
    )
  })

  it('creates booking as confirmed when seats are available', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(futureTour)
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    mdb.booking.count.mockResolvedValueOnce(0) // primaryCount
    mdb.booking.count.mockResolvedValueOnce(0) // otherCount
    mdb.booking.count.mockResolvedValueOnce(0) // totalConfirmed
    mdb.booking.findUnique.mockResolvedValueOnce(null)
    mdb.booking.create.mockResolvedValueOnce({ ...mockBookingRow, status: 'confirmed' })

    const result = await createBooking('tour-1', 'user-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.booking.status).toBe('confirmed')
      expect(typeof result.booking.bookedAt).toBe('string')
    }
  })

  it('creates booking as waitlist when all pools are at capacity', async () => {
    // capacity=10 → junior=2, non_junior=3, anyone=5; all slots used
    mdb.tour.findUnique.mockResolvedValueOnce(futureTour)
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy) // junior buddy
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    mdb.booking.count.mockResolvedValueOnce(2)  // primaryCount (junior) = 2 — full
    mdb.booking.count.mockResolvedValueOnce(3)  // otherCount (non_junior) = 3 — full
    mdb.booking.count.mockResolvedValueOnce(10) // totalConfirmed = 10; anyoneConfirmed=10-2-3=5 ≥ 5
    mdb.booking.findUnique.mockResolvedValueOnce(null)
    mdb.booking.create.mockResolvedValueOnce({ ...mockBookingRow, status: 'waitlist' })

    const result = await createBooking('tour-1', 'user-1')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.booking.status).toBe('waitlist')
  })

  it('stores buddyId, tourId, and buddyTier on the created booking', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(futureTour)
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    mdb.booking.count.mockResolvedValueOnce(0) // primaryCount
    mdb.booking.count.mockResolvedValueOnce(0) // otherCount
    mdb.booking.count.mockResolvedValueOnce(0) // totalConfirmed
    mdb.booking.findUnique.mockResolvedValueOnce(null)
    mdb.booking.create.mockResolvedValueOnce(mockBookingRow)

    await createBooking('tour-1', 'user-1')
    expect(mdb.booking.create).toHaveBeenCalledWith(
      oc({ data: oc({ buddyId: 'buddy-1', tourId: 'tour-1', buddyTier: 'junior' }) })
    )
  })
})

describe('updateBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns BUDDY_NOT_FOUND when buddy profile does not exist', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(null)
    mdb.tour.findUnique.mockResolvedValueOnce(futureTourWithDeadline)
    const result = await updateBooking('tour-1', 'user-1', 'declined')
    expect(result).toEqual({ ok: false, code: 'BUDDY_NOT_FOUND' })
  })

  it('returns NOT_FOUND when tour does not exist', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tour.findUnique.mockResolvedValueOnce(null)
    const result = await updateBooking('tour-1', 'user-1', 'declined')
    expect(result).toEqual({ ok: false, code: 'NOT_FOUND' })
  })

  it('returns NOT_FOUND when booking does not exist', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tour.findUnique.mockResolvedValueOnce(futureTourWithDeadline)
    mdb.booking.findUnique.mockResolvedValueOnce(null)
    mdb.buddyCancellationDeadlineOverride.findUnique.mockResolvedValueOnce(null)
    const result = await updateBooking('tour-1', 'user-1', 'declined')
    expect(result).toEqual({ ok: false, code: 'NOT_FOUND' })
  })

  it('returns DEADLINE_PASSED when cancellation deadline has passed', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tour.findUnique.mockResolvedValueOnce({ cancellationDeadline: new Date('2000-01-01'), capacity: 10 })
    mdb.booking.findUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'confirmed', buddyTier: 'junior' })
    mdb.buddyCancellationDeadlineOverride.findUnique.mockResolvedValueOnce(null)
    const result = await updateBooking('tour-1', 'user-1', 'maybe')
    expect(result).toEqual({ ok: false, code: 'DEADLINE_PASSED' })
  })

  it('returns REASON_REQUIRED when declining confirmed booking without reason', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tour.findUnique.mockResolvedValueOnce(futureTourWithDeadline)
    mdb.booking.findUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'confirmed', buddyTier: 'junior' })
    mdb.buddyCancellationDeadlineOverride.findUnique.mockResolvedValueOnce(null)
    const result = await updateBooking('tour-1', 'user-1', 'declined')
    expect(result).toEqual({ ok: false, code: 'REASON_REQUIRED' })
  })

  it('updates confirmed booking to maybe', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tour.findUnique.mockResolvedValueOnce(futureTourWithDeadline)
    mdb.booking.findUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'confirmed', buddyTier: 'junior' })
    mdb.buddyCancellationDeadlineOverride.findUnique.mockResolvedValueOnce(null)
    mdb.booking.update.mockResolvedValueOnce({ ...mockBookingRow, status: 'maybe' })

    const result = await updateBooking('tour-1', 'user-1', 'maybe')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.booking.status).toBe('maybe')
  })

  it('updates confirmed booking to waitlist', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tour.findUnique.mockResolvedValueOnce(futureTourWithDeadline)
    mdb.booking.findUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'confirmed', buddyTier: 'junior' })
    mdb.buddyCancellationDeadlineOverride.findUnique.mockResolvedValueOnce(null)
    mdb.booking.update.mockResolvedValueOnce({ ...mockBookingRow, status: 'waitlist' })

    const result = await updateBooking('tour-1', 'user-1', 'waitlist')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.booking.status).toBe('waitlist')
  })

  it('returns TOUR_FULL when confirming and both pools are at capacity', async () => {
    // capacity=10 → junior=2, non_junior=3, anyone=5; all slots used
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tour.findUnique.mockResolvedValueOnce(futureTourWithDeadline)
    mdb.booking.findUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'maybe', buddyTier: 'junior' })
    mdb.buddyCancellationDeadlineOverride.findUnique.mockResolvedValueOnce(null)
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    mdb.booking.count.mockResolvedValueOnce(2)  // primaryCount (junior) = 2 — full
    mdb.booking.count.mockResolvedValueOnce(3)  // otherCount (non_junior) = 3 — full
    mdb.booking.count.mockResolvedValueOnce(10) // totalConfirmed; anyoneConfirmed=10-2-3=5 ≥ 5

    const result = await updateBooking('tour-1', 'user-1', 'confirmed')
    expect(result).toEqual({ ok: false, code: 'TOUR_FULL' })
  })

  it('allows confirm when seats are available', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tour.findUnique.mockResolvedValueOnce(futureTourWithDeadline)
    mdb.booking.findUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'maybe', buddyTier: 'junior' })
    mdb.buddyCancellationDeadlineOverride.findUnique.mockResolvedValueOnce(null)
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    mdb.booking.count.mockResolvedValueOnce(1) // primaryCount < 2 — space in primary
    mdb.booking.count.mockResolvedValueOnce(0) // otherCount
    mdb.booking.count.mockResolvedValueOnce(1) // totalConfirmed; anyoneConfirmed=max(0,1-1-0)=0 < 5
    mdb.booking.update.mockResolvedValueOnce({ ...mockBookingRow, status: 'confirmed' })

    const result = await updateBooking('tour-1', 'user-1', 'confirmed')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.booking.status).toBe('confirmed')
  })

  it('promotes waitlist when confirmed booking is declined with reason', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tour.findUnique.mockResolvedValueOnce(futureTourWithDeadline)
    mdb.booking.findUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'confirmed', buddyTier: 'junior' })
    mdb.buddyCancellationDeadlineOverride.findUnique.mockResolvedValueOnce(null)
    mdb.booking.update.mockResolvedValueOnce({ ...mockBookingRow, status: 'declined' })
    mdb.cancellationReason.create.mockResolvedValueOnce({})
    // promoteWaitlist: getPoolCapacities, findWaitlistCandidate, counts, update
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    mdb.booking.findFirst.mockResolvedValueOnce({ id: 'waitlist-booking-1', buddyTier: 'junior' })
    mdb.booking.count.mockResolvedValueOnce(0)  // primaryConfirmed (junior) < cap
    mdb.booking.count.mockResolvedValueOnce(0)  // otherConfirmed (non_junior)
    mdb.booking.count.mockResolvedValueOnce(0)  // totalConfirmed; anyoneConfirmed=0 < 5
    mdb.booking.update.mockResolvedValueOnce({})

    await updateBooking('tour-1', 'user-1', 'declined', mockReason)
    expect(mdb.booking.update).toHaveBeenCalledTimes(2)
    expect(mdb.booking.update).toHaveBeenNthCalledWith(2,
      oc({ where: oc({ id: 'waitlist-booking-1' }), data: oc({ status: 'confirmed' }) })
    )
  })

  it('records cancellation reason when confirmed booking is declined', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tour.findUnique.mockResolvedValueOnce(futureTourWithDeadline)
    mdb.booking.findUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'confirmed', buddyTier: 'junior' })
    mdb.buddyCancellationDeadlineOverride.findUnique.mockResolvedValueOnce(null)
    mdb.booking.update.mockResolvedValueOnce({ ...mockBookingRow, status: 'declined' })
    mdb.cancellationReason.create.mockResolvedValueOnce({})
    // promoteWaitlist: no waitlist candidates
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    mdb.booking.findFirst.mockResolvedValueOnce(null)

    await updateBooking('tour-1', 'user-1', 'declined', mockReason)
    expect(mdb.cancellationReason.create).toHaveBeenCalledOnce()
    expect(mdb.cancellationReason.create).toHaveBeenCalledWith(
      oc({ data: oc({ category: 'health', unavoidable: false, recordedBy: 'user-1' }) })
    )
  })

  it('does not promote waitlist when maybe booking is declined', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tour.findUnique.mockResolvedValueOnce(futureTourWithDeadline)
    mdb.booking.findUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'maybe', buddyTier: 'junior' })
    mdb.buddyCancellationDeadlineOverride.findUnique.mockResolvedValueOnce(null)
    mdb.booking.update.mockResolvedValueOnce({ ...mockBookingRow, status: 'declined' })

    await updateBooking('tour-1', 'user-1', 'declined')
    expect(mdb.booking.update).toHaveBeenCalledTimes(1)
  })

  it('does not promote waitlist when both pools remain full after decline', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tour.findUnique.mockResolvedValueOnce(futureTourWithDeadline)
    mdb.booking.findUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'confirmed', buddyTier: 'junior' })
    mdb.buddyCancellationDeadlineOverride.findUnique.mockResolvedValueOnce(null)
    mdb.booking.update.mockResolvedValueOnce({ ...mockBookingRow, status: 'declined' })
    mdb.cancellationReason.create.mockResolvedValueOnce({})
    // promoteWaitlist: candidate found, but pools still full
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    mdb.booking.findFirst.mockResolvedValueOnce({ id: 'waitlist-1', buddyTier: 'junior' })
    mdb.booking.count.mockResolvedValueOnce(2)  // primaryConfirmed (junior) = 2 — full
    mdb.booking.count.mockResolvedValueOnce(3)  // otherConfirmed (non_junior) = 3 — full
    mdb.booking.count.mockResolvedValueOnce(10) // totalConfirmed; anyoneConfirmed=10-2-3=5 ≥ 5

    await updateBooking('tour-1', 'user-1', 'declined', mockReason)
    expect(mdb.booking.update).toHaveBeenCalledTimes(1)
  })

  it('uses per-buddy deadline override when set', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockBuddy)
    mdb.tour.findUnique.mockResolvedValueOnce({ cancellationDeadline: new Date('2099-01-01'), capacity: 10 })
    mdb.booking.findUnique.mockResolvedValueOnce({ id: 'booking-1', status: 'maybe', buddyTier: 'junior' })
    mdb.buddyCancellationDeadlineOverride.findUnique.mockResolvedValueOnce({ deadline: new Date('2000-01-01') })

    const result = await updateBooking('tour-1', 'user-1', 'maybe')
    expect(result).toEqual({ ok: false, code: 'DEADLINE_PASSED' })
  })
})
