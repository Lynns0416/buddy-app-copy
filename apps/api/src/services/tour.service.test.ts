import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { listTours, getTour } from './tour.service'

type MockFn = Mock<(...args: unknown[]) => unknown>

interface MockDb {
  tour: { findMany: MockFn; findUnique: MockFn }
  booking: { groupBy: MockFn; findFirst: MockFn; count: MockFn }
  buddyProfile: { findFirst: MockFn }
  tierCapacity: { findMany: MockFn }
}

vi.mock('../lib/db', () => {
  const mockDb: MockDb = {
    tour: { findMany: vi.fn(), findUnique: vi.fn() },
    booking: { groupBy: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    buddyProfile: { findFirst: vi.fn() },
    tierCapacity: { findMany: vi.fn() },
  }
  return { db: mockDb }
})

import { db } from '../lib/db'
const mdb = db as unknown as MockDb

const mockRow = {
  id: 'tour-1',
  groupId: 'group-1',
  group: { id: 'group-1', name: 'Test School', type: 'school' },
  status: 'published',
  tourDate: new Date('2026-05-01'),
  meetingTime: new Date('1970-01-01T09:00:00.000Z'),
  startTime: null,
  endTime: null,
  bookingOpen: true,
  location: 'Tokyo Station',
  capacity: 10,
  participantCount: 0,
  description: null,
  cancellationDeadline: new Date('2026-04-28'),
  maybeDeadline: null,
  notificationOffsets: [7, 3],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

describe('listTours', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps all date fields to ISO strings', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([mockRow])
    const result = await listTours()
    expect(result).toHaveLength(1)
    const t = result[0]
    expect(typeof t.tourDate).toBe('string')
    expect(typeof t.meetingTime).toBe('string')
    expect(typeof t.cancellationDeadline).toBe('string')
    expect(typeof t.createdAt).toBe('string')
    expect(typeof t.updatedAt).toBe('string')
  })

  it('passes through startTime, endTime, and bookingOpen', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([mockRow])
    const result = await listTours()
    expect(result[0].startTime).toBeNull()
    expect(result[0].endTime).toBeNull()
    expect(result[0].bookingOpen).toBe(true)
  })

  it('maps non-null startTime and endTime to ISO strings', async () => {
    const rowWithTimes = {
      ...mockRow,
      startTime: new Date('1970-01-01T09:00:00.000Z'),
      endTime: new Date('1970-01-01T11:00:00.000Z'),
    }
    mdb.tour.findMany.mockResolvedValueOnce([rowWithTimes])
    const result = await listTours()
    expect(typeof result[0].startTime).toBe('string')
    expect(typeof result[0].endTime).toBe('string')
  })

  it('defaults to published status when no filters given', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])
    await listTours()
    const call = mdb.tour.findMany.mock.calls[0][0] as { where: { status: string } }
    expect(call.where.status).toBe('published')
  })

  it('uses provided status filter', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])
    await listTours({ status: 'completed' })
    const call = mdb.tour.findMany.mock.calls[0][0] as { where: { status: string } }
    expect(call.where.status).toBe('completed')
  })

  it('applies from/to date filters on tourDate', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])
    const from = new Date('2026-05-01')
    const to = new Date('2026-05-31')
    await listTours({ from, to })
    const call = mdb.tour.findMany.mock.calls[0][0] as { where: { tourDate: unknown } }
    expect(call.where.tourDate).toEqual({ gte: from, lte: to })
  })

  it('applies only from when to is not provided', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])
    const from = new Date('2026-05-01')
    await listTours({ from })
    const call = mdb.tour.findMany.mock.calls[0][0] as { where: { tourDate: unknown } }
    expect(call.where.tourDate).toEqual({ gte: from })
  })

  it('orders by tourDate ascending', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])
    await listTours()
    const call = mdb.tour.findMany.mock.calls[0][0] as { orderBy: unknown }
    expect(call.orderBy).toEqual({ tourDate: 'asc' })
  })

  it('does not include adminMemo in the select', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])
    await listTours()
    const call = mdb.tour.findMany.mock.calls[0][0] as { select: Record<string, unknown> }
    expect(call.select.adminMemo).toBeUndefined()
  })
})

describe('getTour', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when tour not found', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(null)
    mdb.booking.groupBy.mockResolvedValueOnce([])
    mdb.booking.findFirst.mockResolvedValueOnce(null)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce(null)
    const result = await getTour('nonexistent', 'user-1')
    expect(result).toBeNull()
  })

  it('returns tour detail with seat counts and myBookingStatus', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.booking.groupBy.mockResolvedValueOnce([
      { status: 'confirmed', _count: { status: 3 } },
      { status: 'maybe', _count: { status: 1 } },
    ])
    mdb.booking.findFirst.mockResolvedValueOnce({ status: 'confirmed' })
    mdb.buddyProfile.findFirst.mockResolvedValueOnce(null)

    const result = await getTour('tour-1', 'user-1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('tour-1')
    expect(result!.seatCounts).toEqual({ confirmed: 3, maybe: 1, waitlist: 0, declined: 0 })
    expect(result!.remaining).toBe(7)
    expect(result!.myBookingStatus).toBe('confirmed')
    expect(result!.myCapacity).toBeNull()
    expect(result!.myRemaining).toBeNull()
  })

  it('returns myBookingStatus null when buddy has no booking', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.booking.groupBy.mockResolvedValueOnce([])
    mdb.booking.findFirst.mockResolvedValueOnce(null)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce(null)

    const result = await getTour('tour-1', 'user-1')
    expect(result!.myBookingStatus).toBeNull()
    expect(result!.seatCounts).toEqual({ confirmed: 0, maybe: 0, waitlist: 0, declined: 0 })
    expect(result!.remaining).toBe(10)
    expect(result!.myCapacity).toBeNull()
    expect(result!.myRemaining).toBeNull()
  })

  it('computes myCapacity and myRemaining for junior buddy with no bookings', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.booking.groupBy.mockResolvedValueOnce([])
    mdb.booking.findFirst.mockResolvedValueOnce(null)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ tier: 'junior' })
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    mdb.booking.count
      .mockResolvedValueOnce(0)  // primaryConfirmed (junior)
      .mockResolvedValueOnce(0)  // otherConfirmed (non_junior)
      .mockResolvedValueOnce(0)  // totalConfirmed

    const result = await getTour('tour-1', 'user-1')
    // defaults: junior=2, anyone=5 → myCapacity=7
    expect(result!.myCapacity).toBe(7)
    // anyoneConfirmed=max(0, 0-min(0,2)-min(0,3))=0; primaryRemaining=2; anyoneRemaining=5
    expect(result!.myRemaining).toBe(7)
  })

  it('non-junior bookings do not reduce junior myRemaining when within non_junior pool', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.booking.groupBy.mockResolvedValueOnce([])
    mdb.booking.findFirst.mockResolvedValueOnce(null)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ tier: 'junior' })
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    mdb.booking.count
      .mockResolvedValueOnce(0)  // primaryConfirmed (junior)
      .mockResolvedValueOnce(2)  // otherConfirmed (non_junior, within their 3-slot pool)
      .mockResolvedValueOnce(2)  // totalConfirmed

    const result = await getTour('tour-1', 'user-1')
    // anyoneConfirmed=max(0, 2-min(0,2)-min(2,3))=max(0,2-0-2)=0
    // primaryRemaining=2; anyoneRemaining=5
    expect(result!.myRemaining).toBe(7)
  })

  it('computes myCapacity and myRemaining for non-junior buddy with pool full', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.booking.groupBy.mockResolvedValueOnce([])
    mdb.booking.findFirst.mockResolvedValueOnce(null)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ tier: 'senior' })
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    mdb.booking.count
      .mockResolvedValueOnce(3)  // primaryConfirmed (non_junior) — pool full (3)
      .mockResolvedValueOnce(1)  // otherConfirmed (junior)
      .mockResolvedValueOnce(4)  // totalConfirmed

    const result = await getTour('tour-1', 'user-1')
    // defaults: non_junior=3, anyone=5 → myCapacity=8
    expect(result!.myCapacity).toBe(8)
    // anyoneConfirmed=max(0, 4-min(3,3)-min(1,2))=max(0,4-3-1)=0
    // primaryRemaining=0; anyoneRemaining=5
    expect(result!.myRemaining).toBe(5)
  })

  it('does not include adminMemo in select', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(null)
    mdb.booking.groupBy.mockResolvedValueOnce([])
    mdb.booking.findFirst.mockResolvedValueOnce(null)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce(null)
    await getTour('tour-1', 'user-1')
    const call = mdb.tour.findUnique.mock.calls[0][0] as { select: Record<string, unknown> }
    expect(call.select.adminMemo).toBeUndefined()
  })

  it('passes userId to booking findFirst for myBookingStatus lookup', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.booking.groupBy.mockResolvedValueOnce([])
    mdb.booking.findFirst.mockResolvedValueOnce(null)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce(null)
    await getTour('tour-1', 'user-42')
    const call = mdb.booking.findFirst.mock.calls[0][0] as { where: { buddy: { userId: string } } }
    expect(call.where.buddy.userId).toBe('user-42')
  })
})
