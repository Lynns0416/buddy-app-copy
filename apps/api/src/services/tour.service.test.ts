import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { listTours, getTour } from './tour.service'

type MockFn = Mock<(...args: unknown[]) => unknown>

interface MockDb {
  tour: { findMany: MockFn; findUnique: MockFn }
  booking: { groupBy: MockFn; findMany: MockFn }
  buddyProfile: { findFirst: MockFn }
  tierCapacity: { findMany: MockFn }
}

vi.mock('../lib/db', () => {
  const mockDb: MockDb = {
    tour: { findMany: vi.fn(), findUnique: vi.fn() },
    booking: { groupBy: vi.fn(), findMany: vi.fn() },
    buddyProfile: { findFirst: vi.fn() },
    tierCapacity: { findMany: vi.fn() },
  }
  return { db: mockDb }
})

import { db } from '../lib/db'
const mdb = db as unknown as MockDb

const mockSessionRow = {
  id: 'session-1',
  order: 1,
  label: null,
  meetingTime: new Date('1970-01-01T09:00:00.000Z'),
  startTime: null as Date | null,
  endTime: null as Date | null,
  capacity: 10,
  minBuddies: null as number | null,
  participantCount: 0,
}

const mockRow = {
  id: 'tour-1',
  groupId: 'group-1',
  group: { id: 'group-1', name: 'Test School', type: 'school' },
  status: 'published',
  tourDate: new Date('2026-05-01'),
  bookingOpen: true,
  location: 'Tokyo Station',
  description: null,
  cancellationDeadline: new Date('2026-04-28'),
  maybeDeadline: null as Date | null,
  notificationOffsets: [7, 3],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  sessions: [mockSessionRow],
}

describe('listTours', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mdb.buddyProfile.findFirst.mockResolvedValue({ tier: 'junior' })
  })

  it('returns empty array for trainee buddy', async () => {
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ status: 'trainee' })
    const result = await listTours('user-1')
    expect(result).toEqual([])
    expect(mdb.tour.findMany).not.toHaveBeenCalled()
  })

  it('maps tourDate and other date fields to ISO strings', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([mockRow])
    const result = await listTours('user-1')
    expect(result).toHaveLength(1)
    const t = result[0]
    expect(typeof t.tourDate).toBe('string')
    expect(typeof t.cancellationDeadline).toBe('string')
    expect(typeof t.createdAt).toBe('string')
    expect(typeof t.updatedAt).toBe('string')
  })

  it('maps session meetingTime to ISO string', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([mockRow])
    const result = await listTours('user-1')
    expect(typeof result[0].sessions[0].meetingTime).toBe('string')
  })

  it('passes through null startTime and endTime in sessions', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([mockRow])
    const result = await listTours('user-1')
    expect(result[0].sessions[0].startTime).toBeNull()
    expect(result[0].sessions[0].endTime).toBeNull()
  })

  it('maps non-null session startTime and endTime to ISO strings', async () => {
    const rowWithTimes = {
      ...mockRow,
      sessions: [{
        ...mockSessionRow,
        startTime: new Date('1970-01-01T09:00:00.000Z'),
        endTime: new Date('1970-01-01T11:00:00.000Z'),
      }],
    }
    mdb.tour.findMany.mockResolvedValueOnce([rowWithTimes])
    const result = await listTours('user-1')
    expect(typeof result[0].sessions[0].startTime).toBe('string')
    expect(typeof result[0].sessions[0].endTime).toBe('string')
  })

  it('passes through bookingOpen', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([mockRow])
    const result = await listTours('user-1')
    expect(result[0].bookingOpen).toBe(true)
  })

  it('exposes minBuddies and belowMinimum=false when minBuddies is null', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([mockRow])
    const result = await listTours('user-1')
    expect(result[0].sessions[0].minBuddies).toBeNull()
    expect(result[0].sessions[0].belowMinimum).toBe(false)
  })

  it('sets belowMinimum=true when participantCount < minBuddies', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { ...mockRow, sessions: [{ ...mockSessionRow, minBuddies: 5, participantCount: 2 }] },
    ])
    const result = await listTours('user-1')
    expect(result[0].sessions[0].minBuddies).toBe(5)
    expect(result[0].sessions[0].belowMinimum).toBe(true)
  })

  it('sets belowMinimum=false when participantCount equals minBuddies', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { ...mockRow, sessions: [{ ...mockSessionRow, minBuddies: 3, participantCount: 3 }] },
    ])
    const result = await listTours('user-1')
    expect(result[0].sessions[0].belowMinimum).toBe(false)
  })

  it('sets belowMinimum=false when participantCount exceeds minBuddies', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { ...mockRow, sessions: [{ ...mockSessionRow, minBuddies: 2, participantCount: 5 }] },
    ])
    const result = await listTours('user-1')
    expect(result[0].sessions[0].belowMinimum).toBe(false)
  })

  it('defaults to published status when no filters given', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])
    await listTours('user-1')
    const call = mdb.tour.findMany.mock.calls[0][0] as { where: { status: string } }
    expect(call.where.status).toBe('published')
  })

  it('uses provided status filter', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])
    await listTours('user-1', { status: 'completed' })
    const call = mdb.tour.findMany.mock.calls[0][0] as { where: { status: string } }
    expect(call.where.status).toBe('completed')
  })

  it('applies from/to date filters on tourDate', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])
    const from = new Date('2026-05-01')
    const to = new Date('2026-05-31')
    await listTours('user-1', { from, to })
    const call = mdb.tour.findMany.mock.calls[0][0] as { where: { tourDate: unknown } }
    expect(call.where.tourDate).toEqual({ gte: from, lte: to })
  })

  it('applies only from when to is not provided', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])
    const from = new Date('2026-05-01')
    await listTours('user-1', { from })
    const call = mdb.tour.findMany.mock.calls[0][0] as { where: { tourDate: unknown } }
    expect(call.where.tourDate).toEqual({ gte: from })
  })

  it('orders by tourDate ascending', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])
    await listTours('user-1')
    const call = mdb.tour.findMany.mock.calls[0][0] as { orderBy: unknown }
    expect(call.orderBy).toEqual({ tourDate: 'asc' })
  })

  it('does not include adminMemo in the select', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])
    await listTours('user-1')
    const call = mdb.tour.findMany.mock.calls[0][0] as { select: Record<string, unknown> }
    expect(call.select.adminMemo).toBeUndefined()
  })
})

describe('getTour', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when tour not found', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(null)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce(null)
    const result = await getTour('nonexistent', 'user-1')
    expect(result).toBeNull()
  })

  it('returns null for trainee buddy even when tour exists', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ status: 'trainee' })
    const result = await getTour('tour-1', 'user-1')
    expect(result).toBeNull()
  })

  it('returns tour detail with per-session seat counts and myBookingStatus', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ tier: null }) // truthy but no tier
    // groupBy(sessionId, status) — seat counts
    mdb.booking.groupBy.mockResolvedValueOnce([
      { sessionId: 'session-1', status: 'confirmed', _count: { status: 3 } },
      { sessionId: 'session-1', status: 'maybe', _count: { status: 1 } },
    ])
    // findMany — my bookings (no tier so no second groupBy)
    mdb.booking.findMany.mockResolvedValueOnce([{ sessionId: 'session-1', status: 'confirmed' }])

    const result = await getTour('tour-1', 'user-1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('tour-1')
    expect(result!.sessions[0].seatCounts).toEqual({ confirmed: 3, maybe: 1, waitlist: 0, declined: 0 })
    expect(result!.sessions[0].remaining).toBe(7)
    expect(result!.sessions[0].myBookingStatus).toBe('confirmed')
    expect(result!.sessions[0].myCapacity).toBeNull()
    expect(result!.sessions[0].myRemaining).toBeNull()
  })

  it('returns myBookingStatus null when buddy has no booking', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ tier: null })
    mdb.booking.groupBy.mockResolvedValueOnce([])
    mdb.booking.findMany.mockResolvedValueOnce([])

    const result = await getTour('tour-1', 'user-1')
    expect(result!.sessions[0].myBookingStatus).toBeNull()
    expect(result!.sessions[0].seatCounts).toEqual({ confirmed: 0, maybe: 0, waitlist: 0, declined: 0 })
    expect(result!.sessions[0].remaining).toBe(10)
    expect(result!.sessions[0].myCapacity).toBeNull()
    expect(result!.sessions[0].myRemaining).toBeNull()
  })

  it('myBookingStatus and myCapacity are null when no buddyProfile', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce(null)
    // groupBy(sessionId, status) only — no findMany or tier groupBy (no profile)
    mdb.booking.groupBy.mockResolvedValueOnce([])

    const result = await getTour('tour-1', 'user-1')
    expect(result!.sessions[0].myBookingStatus).toBeNull()
    expect(result!.sessions[0].myCapacity).toBeNull()
    expect(result!.sessions[0].myRemaining).toBeNull()
  })

  it('computes myCapacity and myRemaining for junior buddy with no bookings', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ tier: 'junior' })
    // groupBy(sessionId, status) — seat counts (all 0 → totalConfirmed=0)
    mdb.booking.groupBy
      .mockResolvedValueOnce([])                                 // seat counts
      .mockResolvedValueOnce([])                                 // tier counts (no confirmed bookings)
    mdb.booking.findMany.mockResolvedValueOnce([])              // my bookings
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])         // defaults: junior=2, non_junior=3, anyone=5

    const result = await getTour('tour-1', 'user-1')
    // defaults: junior=2, anyone=5 → myCapacity=7
    expect(result!.sessions[0].myCapacity).toBe(7)
    // anyoneConfirmed=max(0, 0-min(0,2)-min(0,3))=0; primaryRemaining=2; anyoneRemaining=5
    expect(result!.sessions[0].myRemaining).toBe(7)
  })

  it('non-junior bookings do not reduce junior myRemaining when within non_junior pool', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ tier: 'junior' })
    // 2 confirmed non-junior bookings
    mdb.booking.groupBy
      .mockResolvedValueOnce([{ sessionId: 'session-1', status: 'confirmed', _count: { status: 2 } }])
      .mockResolvedValueOnce([{ sessionId: 'session-1', buddyTier: 'mid', _count: { buddyTier: 2 } }])
    mdb.booking.findMany.mockResolvedValueOnce([])
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])

    const result = await getTour('tour-1', 'user-1')
    // anyoneConfirmed=max(0, 2-min(0,2)-min(2,3))=max(0,2-0-2)=0
    // primaryRemaining=2; anyoneRemaining=5
    expect(result!.sessions[0].myRemaining).toBe(7)
  })

  it('computes myCapacity and myRemaining for non-junior buddy with pool full', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ tier: 'senior' })
    // 4 confirmed total: 3 senior (non_junior), 1 junior
    mdb.booking.groupBy
      .mockResolvedValueOnce([{ sessionId: 'session-1', status: 'confirmed', _count: { status: 4 } }])
      .mockResolvedValueOnce([
        { sessionId: 'session-1', buddyTier: 'senior', _count: { buddyTier: 3 } },
        { sessionId: 'session-1', buddyTier: 'junior', _count: { buddyTier: 1 } },
      ])
    mdb.booking.findMany.mockResolvedValueOnce([])
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])

    const result = await getTour('tour-1', 'user-1')
    // defaults: non_junior=3, anyone=5 → myCapacity=8
    expect(result!.sessions[0].myCapacity).toBe(8)
    // anyoneConfirmed=max(0, 4-min(3,3)-min(1,2))=max(0,4-3-1)=0
    // primaryRemaining=0; anyoneRemaining=5
    expect(result!.sessions[0].myRemaining).toBe(5)
  })

  it('does not include adminMemo in select', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(null)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce(null)
    await getTour('tour-1', 'user-1')
    const call = mdb.tour.findUnique.mock.calls[0][0] as { select: Record<string, unknown> }
    expect(call.select.adminMemo).toBeUndefined()
  })

  it('passes userId to booking findMany for myBookingStatus lookup', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ tier: null })
    mdb.booking.groupBy.mockResolvedValueOnce([])
    mdb.booking.findMany.mockResolvedValueOnce([])
    await getTour('tour-1', 'user-42')
    const call = mdb.booking.findMany.mock.calls[0][0] as { where: { buddy: { userId: string } } }
    expect(call.where.buddy.userId).toBe('user-42')
  })
})
