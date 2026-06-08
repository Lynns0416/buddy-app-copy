import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import {
  TourNotFoundError,
  TourImmutableError,
} from './adminTour.service'
import {
  addSession,
  updateSession,
  deleteSession,
  getSessionTierCapacities,
  upsertSessionTierCapacities,
  TooManySessionsError,
  SessionNotFoundError,
  SessionHasBookingsError,
  LastSessionError,
} from './adminSession.service'

type MockFn = Mock<(...args: unknown[]) => unknown>

interface MockDb {
  tour: { findUnique: MockFn; update: MockFn; delete: MockFn }
  tourSession: {
    create: MockFn
    findUnique: MockFn
    update: MockFn
    delete: MockFn
    count: MockFn
    findMany: MockFn
  }
  tierCapacity: { findMany: MockFn; upsert: MockFn }
  $transaction: MockFn
}

vi.mock('../lib/db', () => {
  const $transaction = vi.fn()
  const mockDb: MockDb = {
    tour: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    tourSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    tierCapacity: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction,
  }
  $transaction.mockImplementation((opOrFn: unknown) => {
    if (typeof opOrFn === 'function') {
      return (opOrFn as (tx: typeof mockDb) => Promise<unknown>)(mockDb)
    }
    if (Array.isArray(opOrFn)) return Promise.all(opOrFn)
    return Promise.resolve()
  })
  return { db: mockDb }
})

import { db } from '../lib/db'
const mdb = db as unknown as MockDb

function oc<T extends Record<string, unknown>>(v: T): T {
  return expect.objectContaining(v) as unknown as T
}

// Minimal tour row for getAdminTourDetail calls inside the service
function makeDetailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tour-1',
    group: { id: 'g1', name: 'Test School', type: 'school' },
    status: 'published',
    tourDate: new Date('2026-06-01'),
    bookingOpen: false,
    location: 'Tokyo',
    description: null,
    adminMemo: null,
    cancellationDeadline: new Date('2026-05-25'),
    maybeDeadline: null,
    notificationOffsets: [3, 1],
    createdAt: new Date(),
    updatedAt: new Date(),
    sessions: [],
    bookings: [],
    adminAssignments: [],
    staffInChargeId: null,
    _count: { bookings: 0 },
    ...overrides,
  }
}

// ── addSession ──────────────────────────────────────────────────────────────

describe('addSession', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws TourNotFoundError when tour does not exist', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(null)
    await expect(addSession('tour-1', { meetingTime: '09:00', capacity: 10 })).rejects.toThrow(TourNotFoundError)
  })

  it('throws TourImmutableError when tour is cancelled', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce({ status: 'cancelled', sessions: [] })
    await expect(addSession('tour-1', { meetingTime: '09:00', capacity: 10 })).rejects.toThrow(TourImmutableError)
  })

  it('throws TourImmutableError when tour is completed', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce({ status: 'completed', sessions: [] })
    await expect(addSession('tour-1', { meetingTime: '09:00', capacity: 10 })).rejects.toThrow(TourImmutableError)
  })

  it('throws TooManySessionsError when tour already has 2 sessions', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce({
      status: 'published',
      sessions: [{ order: 1 }, { order: 2 }],
    })
    await expect(addSession('tour-1', { meetingTime: '09:00', capacity: 10 })).rejects.toThrow(TooManySessionsError)
  })

  it('creates session with next order when tour has 1 existing session', async () => {
    mdb.tour.findUnique
      .mockResolvedValueOnce({ status: 'published', sessions: [{ order: 1 }] })
      .mockResolvedValueOnce(makeDetailRow())
    mdb.tourSession.create.mockResolvedValueOnce({})

    await addSession('tour-1', { meetingTime: '10:30', capacity: 8 })

    expect(mdb.tourSession.create).toHaveBeenCalledWith(
      oc({ data: oc({ tourId: 'tour-1', order: 2, capacity: 8 }) })
    )
  })

  it('creates session as order 1 for new tour with no sessions', async () => {
    mdb.tour.findUnique
      .mockResolvedValueOnce({ status: 'draft', sessions: [] })
      .mockResolvedValueOnce(makeDetailRow())
    mdb.tourSession.create.mockResolvedValueOnce({})

    await addSession('tour-1', { meetingTime: '09:00', capacity: 5 })

    expect(mdb.tourSession.create).toHaveBeenCalledWith(
      oc({ data: oc({ tourId: 'tour-1', order: 1 }) })
    )
  })

  it('passes parsed meetingTime as a Date to tourSession.create', async () => {
    mdb.tour.findUnique
      .mockResolvedValueOnce({ status: 'published', sessions: [] })
      .mockResolvedValueOnce(makeDetailRow())
    mdb.tourSession.create.mockResolvedValueOnce({})

    await addSession('tour-1', { meetingTime: '09:30', capacity: 5 })

    const call = mdb.tourSession.create.mock.calls[0][0] as { data: { meetingTime: Date } }
    expect(call.data.meetingTime).toBeInstanceOf(Date)
    expect(call.data.meetingTime.toISOString()).toBe('1970-01-01T09:30:00.000Z')
  })

  it('persists minBuddies when provided', async () => {
    mdb.tour.findUnique
      .mockResolvedValueOnce({ status: 'draft', sessions: [] })
      .mockResolvedValueOnce(makeDetailRow())
    mdb.tourSession.create.mockResolvedValueOnce({})

    await addSession('tour-1', { meetingTime: '09:00', capacity: 10, minBuddies: 3 })

    expect(mdb.tourSession.create).toHaveBeenCalledWith(
      oc({ data: oc({ minBuddies: 3 }) }),
    )
  })

  it('persists minBuddies as null when omitted', async () => {
    mdb.tour.findUnique
      .mockResolvedValueOnce({ status: 'draft', sessions: [] })
      .mockResolvedValueOnce(makeDetailRow())
    mdb.tourSession.create.mockResolvedValueOnce({})

    await addSession('tour-1', { meetingTime: '09:00', capacity: 10 })

    expect(mdb.tourSession.create).toHaveBeenCalledWith(
      oc({ data: oc({ minBuddies: null }) }),
    )
  })

  it('persists minBuddies as null when explicitly null', async () => {
    mdb.tour.findUnique
      .mockResolvedValueOnce({ status: 'draft', sessions: [] })
      .mockResolvedValueOnce(makeDetailRow())
    mdb.tourSession.create.mockResolvedValueOnce({})

    await addSession('tour-1', { meetingTime: '09:00', capacity: 10, minBuddies: null })

    expect(mdb.tourSession.create).toHaveBeenCalledWith(
      oc({ data: oc({ minBuddies: null }) }),
    )
  })
})

// ── updateSession ───────────────────────────────────────────────────────────

describe('updateSession', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws SessionNotFoundError when session does not exist', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce(null)
    await expect(updateSession('tour-1', 'session-x', { capacity: 10 })).rejects.toThrow(SessionNotFoundError)
  })

  it('throws SessionNotFoundError when session belongs to a different tour', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce({ tourId: 'other-tour' })
    await expect(updateSession('tour-1', 'session-1', { capacity: 10 })).rejects.toThrow(SessionNotFoundError)
  })

  it('calls tourSession.update with the correct args', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce({ tourId: 'tour-1' })
    mdb.tourSession.update.mockResolvedValueOnce({})
    mdb.tour.findUnique.mockResolvedValueOnce(makeDetailRow())

    await updateSession('tour-1', 'session-1', { capacity: 12 })

    expect(mdb.tourSession.update).toHaveBeenCalledWith(
      oc({ where: { id: 'session-1' }, data: oc({ capacity: 12 }) })
    )
  })

  it('parses meetingTime string into Date when provided', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce({ tourId: 'tour-1' })
    mdb.tourSession.update.mockResolvedValueOnce({})
    mdb.tour.findUnique.mockResolvedValueOnce(makeDetailRow())

    await updateSession('tour-1', 'session-1', { meetingTime: '11:00' })

    const call = mdb.tourSession.update.mock.calls[0][0] as { data: { meetingTime: Date } }
    expect(call.data.meetingTime).toBeInstanceOf(Date)
    expect(call.data.meetingTime.toISOString()).toBe('1970-01-01T11:00:00.000Z')
  })

  it('persists minBuddies when provided', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce({ tourId: 'tour-1' })
    mdb.tourSession.update.mockResolvedValueOnce({})
    mdb.tour.findUnique.mockResolvedValueOnce(makeDetailRow())

    await updateSession('tour-1', 'session-1', { minBuddies: 4 })

    expect(mdb.tourSession.update).toHaveBeenCalledWith(
      oc({ where: { id: 'session-1' }, data: oc({ minBuddies: 4 }) }),
    )
  })

  it('clears minBuddies when explicitly null', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce({ tourId: 'tour-1' })
    mdb.tourSession.update.mockResolvedValueOnce({})
    mdb.tour.findUnique.mockResolvedValueOnce(makeDetailRow())

    await updateSession('tour-1', 'session-1', { minBuddies: null })

    expect(mdb.tourSession.update).toHaveBeenCalledWith(
      oc({ where: { id: 'session-1' }, data: oc({ minBuddies: null }) }),
    )
  })

  it('does not set minBuddies when omitted from update', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce({ tourId: 'tour-1' })
    mdb.tourSession.update.mockResolvedValueOnce({})
    mdb.tour.findUnique.mockResolvedValueOnce(makeDetailRow())

    await updateSession('tour-1', 'session-1', { capacity: 12 })

    const call = mdb.tourSession.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(call.data).not.toHaveProperty('minBuddies')
  })
})

// ── deleteSession ───────────────────────────────────────────────────────────

describe('deleteSession', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws SessionNotFoundError when session does not exist', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce(null)
    await expect(deleteSession('tour-1', 'session-x')).rejects.toThrow(SessionNotFoundError)
  })

  it('throws SessionNotFoundError when session belongs to a different tour', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce({
      tourId: 'other-tour',
      _count: { bookings: 0 },
    })
    await expect(deleteSession('tour-1', 'session-1')).rejects.toThrow(SessionNotFoundError)
  })

  it('throws SessionHasBookingsError when session has bookings', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce({
      tourId: 'tour-1',
      _count: { bookings: 3 },
    })
    await expect(deleteSession('tour-1', 'session-1')).rejects.toThrow(SessionHasBookingsError)
  })

  it('throws LastSessionError when session is the last one', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce({
      tourId: 'tour-1',
      _count: { bookings: 0 },
    })
    mdb.tourSession.count.mockResolvedValueOnce(1)
    await expect(deleteSession('tour-1', 'session-1')).rejects.toThrow(LastSessionError)
  })

  it('deletes session and reorders remaining when 2 sessions exist', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce({
      tourId: 'tour-1',
      _count: { bookings: 0 },
    })
    mdb.tourSession.count.mockResolvedValueOnce(2)
    mdb.tourSession.delete.mockResolvedValueOnce({})
    mdb.tourSession.findMany.mockResolvedValueOnce([{ id: 'session-2' }])
    mdb.tourSession.update.mockResolvedValueOnce({})
    mdb.tour.findUnique.mockResolvedValueOnce(makeDetailRow())

    await deleteSession('tour-1', 'session-1')

    expect(mdb.tourSession.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } })
    expect(mdb.tourSession.update).toHaveBeenCalledWith(
      oc({ where: { id: 'session-2' }, data: { order: 1 } })
    )
  })
})

// ── getSessionTierCapacities ────────────────────────────────────────────────

describe('getSessionTierCapacities', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns default capacities when no rows exist', async () => {
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    const result = await getSessionTierCapacities('session-1')
    expect(result).toEqual({ junior: 20, non_junior: 30, anyone: 50 })
  })

  it('returns custom capacities from DB rows', async () => {
    mdb.tierCapacity.findMany.mockResolvedValueOnce([
      { pool: 'junior', percent: 40 },
      { pool: 'non_junior', percent: 40 },
      { pool: 'anyone', percent: 20 },
    ])
    const result = await getSessionTierCapacities('session-1')
    expect(result).toEqual({ junior: 40, non_junior: 40, anyone: 20 })
  })

  it('merges partial DB rows with defaults', async () => {
    mdb.tierCapacity.findMany.mockResolvedValueOnce([
      { pool: 'junior', percent: 60 },
    ])
    const result = await getSessionTierCapacities('session-1')
    expect(result.junior).toBe(60)
    expect(result.non_junior).toBe(30)
    expect(result.anyone).toBe(50)
  })

  it('queries by sessionId', async () => {
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])
    await getSessionTierCapacities('session-abc')
    expect(mdb.tierCapacity.findMany).toHaveBeenCalledWith(
      oc({ where: { sessionId: 'session-abc' } })
    )
  })
})

// ── upsertSessionTierCapacities ─────────────────────────────────────────────

describe('upsertSessionTierCapacities', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws SessionNotFoundError when session does not exist', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce(null)
    await expect(
      upsertSessionTierCapacities('tour-1', 'session-x', { junior: 20, non_junior: 30, anyone: 50 })
    ).rejects.toThrow(SessionNotFoundError)
  })

  it('throws SessionNotFoundError when session belongs to a different tour', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce({ tourId: 'other-tour' })
    await expect(
      upsertSessionTierCapacities('tour-1', 'session-1', { junior: 20, non_junior: 30, anyone: 50 })
    ).rejects.toThrow(SessionNotFoundError)
  })

  it('upserts all 3 pools in a transaction', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce({ tourId: 'tour-1' })
    mdb.tierCapacity.upsert.mockResolvedValue({})
    mdb.tierCapacity.findMany.mockResolvedValueOnce([
      { pool: 'junior', percent: 25 },
      { pool: 'non_junior', percent: 35 },
      { pool: 'anyone', percent: 40 },
    ])

    const result = await upsertSessionTierCapacities('tour-1', 'session-1', { junior: 25, non_junior: 35, anyone: 40 })

    expect(mdb.tierCapacity.upsert).toHaveBeenCalledTimes(3)
    expect(result).toEqual({ junior: 25, non_junior: 35, anyone: 40 })
  })

  it('upserts with correct sessionId and pool', async () => {
    mdb.tourSession.findUnique.mockResolvedValueOnce({ tourId: 'tour-1' })
    mdb.tierCapacity.upsert.mockResolvedValue({})
    mdb.tierCapacity.findMany.mockResolvedValueOnce([])

    await upsertSessionTierCapacities('tour-1', 'session-1', { junior: 20, non_junior: 30, anyone: 50 })

    expect(mdb.tierCapacity.upsert).toHaveBeenCalledWith(
      oc({
        where: { sessionId_pool: { sessionId: 'session-1', pool: 'junior' } },
        create: oc({ sessionId: 'session-1', pool: 'junior', percent: 20 }),
        update: { percent: 20 },
      })
    )
  })
})
