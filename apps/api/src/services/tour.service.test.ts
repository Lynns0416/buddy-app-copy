import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { listTours, getTour, getTourIcs } from './tour.service'

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
    mdb.booking.findMany.mockResolvedValue([])
  })

  it('returns empty array for trainee buddy', async () => {
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ status: 'trainee' })
    const result = await listTours('user-1')
    expect(result).toEqual([])
    expect(mdb.tour.findMany).not.toHaveBeenCalled()
    expect(mdb.booking.findMany).not.toHaveBeenCalled()
  })

  it("returns the caller's booking status per session, from one query across all tours", async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { ...mockRow, sessions: [mockSessionRow, { ...mockSessionRow, id: 'session-2', order: 2 }] },
      { ...mockRow, id: 'tour-2', sessions: [{ ...mockSessionRow, id: 'session-3' }] },
    ])
    mdb.booking.findMany.mockResolvedValueOnce([
      { sessionId: 'session-1', status: 'confirmed' },
      { sessionId: 'session-3', status: 'declined' },
    ])

    const result = await listTours('user-1')

    expect(mdb.booking.findMany).toHaveBeenCalledTimes(1)
    const call = mdb.booking.findMany.mock.calls[0][0] as { where: unknown }
    expect(call.where).toEqual({
      sessionId: { in: ['session-1', 'session-2', 'session-3'] },
      buddy: { userId: 'user-1' },
    })
    expect(result[0].sessions.map((s) => s.myBookingStatus)).toEqual(['confirmed', null])
    expect(result[1].sessions[0].myBookingStatus).toBe('declined')
  })

  it('sets myBookingStatus null when the caller has no booking', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([mockRow])
    const result = await listTours('user-1')
    expect(result[0].sessions[0].myBookingStatus).toBeNull()
  })

  it('skips the booking lookup when the caller has no buddy profile', async () => {
    mdb.buddyProfile.findFirst.mockResolvedValueOnce(null)
    mdb.tour.findMany.mockResolvedValueOnce([mockRow])
    const result = await listTours('user-1')
    expect(mdb.booking.findMany).not.toHaveBeenCalled()
    expect(result[0].sessions[0].myBookingStatus).toBeNull()
  })

  it('skips the booking lookup when no tours match', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])
    await listTours('user-1')
    expect(mdb.booking.findMany).not.toHaveBeenCalled()
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
      .mockResolvedValueOnce([{ sessionId: 'session-1', buddyTier: 'buddy', _count: { buddyTier: 2 } }])
    mdb.booking.findMany.mockResolvedValueOnce([])
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])

    const result = await getTour('tour-1', 'user-1')
    // anyoneConfirmed=max(0, 2-min(0,2)-min(2,3))=max(0,2-0-2)=0
    // primaryRemaining=2; anyoneRemaining=5
    expect(result!.sessions[0].myRemaining).toBe(7)
  })

  it('computes myCapacity and myRemaining for non-junior buddy with pool full', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(mockRow)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ tier: 'star' })
    // 4 confirmed total: 3 star (non_junior), 1 junior
    mdb.booking.groupBy
      .mockResolvedValueOnce([{ sessionId: 'session-1', status: 'confirmed', _count: { status: 4 } }])
      .mockResolvedValueOnce([
        { sessionId: 'session-1', buddyTier: 'star', _count: { buddyTier: 3 } },
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

  it('returns the staff in charge by name only', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce({ ...mockRow, staffInCharge: { name: 'Staff A', deletedAt: null } })
    mdb.buddyProfile.findFirst.mockResolvedValueOnce(null)
    mdb.booking.groupBy.mockResolvedValueOnce([])

    const result = await getTour('tour-1', 'user-1')
    expect(result!.staffInCharge).toEqual({ name: 'Staff A' })
    const call = mdb.tour.findUnique.mock.calls[0][0] as { select: { staffInCharge: { select: Record<string, unknown> } } }
    expect(Object.keys(call.select.staffInCharge.select).sort()).toEqual(['deletedAt', 'name'])
  })

  it('returns staffInCharge null when none is designated or the admin is deleted', async () => {
    mdb.tour.findUnique
      .mockResolvedValueOnce({ ...mockRow, staffInCharge: null })
      .mockResolvedValueOnce({ ...mockRow, staffInCharge: { name: 'Gone', deletedAt: new Date('2026-01-02') } })
    mdb.buddyProfile.findFirst.mockResolvedValue(null)
    mdb.booking.groupBy.mockResolvedValue([])

    expect((await getTour('tour-1', 'user-1'))!.staffInCharge).toBeNull()
    expect((await getTour('tour-1', 'user-1'))!.staffInCharge).toBeNull()
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

describe('getTourIcs', () => {
  const icsRow = {
    tourDate: new Date('2026-05-01'),
    status: 'published',
    location: 'Tokyo Station',
    description: 'A visit.',
    group: { name: 'Test School' },
    sessions: [
      { id: 'session-1', label: null, meetingTime: new Date('1970-01-01T09:00:00.000Z'), startTime: null, endTime: null },
    ],
  }

  beforeEach(() => vi.clearAllMocks())

  it('returns null when the tour is not found', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(null)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce(null)
    expect(await getTourIcs('nonexistent', 'user-1')).toBeNull()
  })

  it('returns null for a trainee buddy even when the tour exists', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(icsRow)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ status: 'trainee' })
    expect(await getTourIcs('tour-1', 'user-1')).toBeNull()
  })

  it('returns null when the buddy has no confirmed session', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(icsRow)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ status: 'active' })
    mdb.booking.findMany.mockResolvedValueOnce([])
    expect(await getTourIcs('tour-1', 'user-1')).toBeNull()
  })

  it('filters bookings to confirmed only, in the query itself', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(icsRow)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ status: 'active' })
    mdb.booking.findMany.mockResolvedValueOnce([])
    await getTourIcs('tour-1', 'user-1')
    const call = mdb.booking.findMany.mock.calls[0][0] as { where: { status: string } }
    expect(call.where.status).toBe('confirmed')
  })

  it('returns an .ics calendar containing only the confirmed session', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(icsRow)
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ status: 'active' })
    mdb.booking.findMany.mockResolvedValueOnce([{ sessionId: 'session-1' }])

    const ics = await getTourIcs('tour-1', 'user-1')
    expect(ics).not.toBeNull()
    expect(ics).toContain('SUMMARY:Test School')
    expect(ics).toContain('LOCATION:Tokyo Station')
    expect(ics).toContain('UID:session-session-1@peace-buddy.internal')
  })

  it('marks a cancelled tour STATUS:CANCELLED under the same UID, so a re-download can retract the event', async () => {
    // Cancelling a tour leaves the Booking rows untouched, so the buddy still
    // holds a confirmed seat and the file is still served — it has to say the
    // tour is off rather than look live.
    mdb.tour.findUnique.mockResolvedValueOnce({ ...icsRow, status: 'cancelled' })
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ status: 'active' })
    mdb.booking.findMany.mockResolvedValueOnce([{ sessionId: 'session-1' }])

    const ics = await getTourIcs('tour-1', 'user-1')
    expect(ics).toContain('STATUS:CANCELLED')
    expect(ics).toContain('UID:session-session-1@peace-buddy.internal')
  })

  it('filters out sessions the buddy is not confirmed on', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce({
      ...icsRow,
      sessions: [
        ...icsRow.sessions,
        { id: 'session-2', label: '2nd Half', meetingTime: new Date('1970-01-01T13:00:00.000Z'), startTime: null, endTime: null },
      ],
    })
    mdb.buddyProfile.findFirst.mockResolvedValueOnce({ status: 'active' })
    mdb.booking.findMany.mockResolvedValueOnce([{ sessionId: 'session-1' }])

    const ics = await getTourIcs('tour-1', 'user-1')
    expect(ics).toContain('session-session-1@peace-buddy.internal')
    expect(ics).not.toContain('session-session-2@peace-buddy.internal')
  })
})
