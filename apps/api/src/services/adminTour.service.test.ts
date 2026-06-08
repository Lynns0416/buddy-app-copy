import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { createTour, getAdminTourDetail, listAdminTours } from './adminTour.service'

// TODO: add tests for updateTour, transitionTourStatus, deleteTour.
// Session and tier-capacity tests live in adminSession.service.test.ts.

type MockFn = Mock<(...args: unknown[]) => unknown>

interface MockDb {
  tour: { create: MockFn; findMany: MockFn; findUnique: MockFn; update: MockFn; delete: MockFn }
}

vi.mock('../lib/db', () => {
  const mockDb: MockDb = {
    tour: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
  return { db: mockDb }
})

import { db } from '../lib/db'
const mdb = db as unknown as MockDb

function makeSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    order: 1,
    label: null,
    meetingTime: new Date('1970-01-01T09:00:00.000Z'),
    startTime: null as Date | null,
    endTime: null as Date | null,
    capacity: 10,
    minBuddies: null as number | null,
    participantCount: 0,
    ...overrides,
  }
}

function makeListRow(sessions: ReturnType<typeof makeSessionRow>[]) {
  return {
    id: 'tour-1',
    group: { id: 'g1', name: 'Test School', type: 'school' },
    status: 'draft',
    tourDate: new Date('2026-06-01'),
    bookingOpen: false,
    location: 'Tokyo',
    description: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    sessions,
    _count: { bookings: 0 },
  }
}

function makeDetailRow(sessions: ReturnType<typeof makeSessionRow>[]) {
  return {
    ...makeListRow(sessions),
    adminMemo: null,
    cancellationDeadline: new Date('2026-05-25'),
    maybeDeadline: null as Date | null,
    notificationOffsets: [3, 1],
    bookings: [],
    adminAssignments: [],
    staffInChargeId: null,
  }
}

// ── createTour ──────────────────────────────────────────────────────────────

describe('createTour', () => {
  beforeEach(() => vi.clearAllMocks())

  it('persists minBuddies on each created session', async () => {
    mdb.tour.create.mockResolvedValueOnce({
      ...makeDetailRow([
        makeSessionRow({ minBuddies: 3, participantCount: 0 }),
      ]),
    })

    await createTour({
      groupId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      tourDate: new Date('2026-06-01'),
      bookingOpen: false,
      location: 'Tokyo',
      cancellationDeadline: new Date('2026-05-25'),
      notificationOffsets: [3, 1],
      sessions: [{ meetingTime: '09:00', capacity: 10, minBuddies: 3 }],
    })

    const call = mdb.tour.create.mock.calls[0][0] as {
      data: { sessions: { create: Array<{ minBuddies: number | null }> } }
    }
    expect(call.data.sessions.create[0].minBuddies).toBe(3)
  })

  it('passes minBuddies=null when omitted', async () => {
    mdb.tour.create.mockResolvedValueOnce({
      ...makeDetailRow([makeSessionRow()]),
    })

    await createTour({
      groupId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      tourDate: new Date('2026-06-01'),
      bookingOpen: false,
      location: 'Tokyo',
      cancellationDeadline: new Date('2026-05-25'),
      notificationOffsets: [3, 1],
      sessions: [{ meetingTime: '09:00', capacity: 10 }],
    })

    const call = mdb.tour.create.mock.calls[0][0] as {
      data: { sessions: { create: Array<{ minBuddies: number | null }> } }
    }
    expect(call.data.sessions.create[0].minBuddies).toBeNull()
  })
})

// ── getAdminTourDetail ──────────────────────────────────────────────────────

describe('getAdminTourDetail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when tour not found', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(null)
    const result = await getAdminTourDetail('missing')
    expect(result).toBeNull()
  })

  it('exposes minBuddies and belowMinimum on each session', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(
      makeDetailRow([
        makeSessionRow({ id: 's1', minBuddies: 5, participantCount: 2 }),
        makeSessionRow({ id: 's2', order: 2, minBuddies: 2, participantCount: 4 }),
      ]),
    )

    const result = await getAdminTourDetail('tour-1')

    expect(result!.sessions[0]).toMatchObject({ minBuddies: 5, belowMinimum: true })
    expect(result!.sessions[1]).toMatchObject({ minBuddies: 2, belowMinimum: false })
  })

  it('belowMinimum=false when minBuddies is null', async () => {
    mdb.tour.findUnique.mockResolvedValueOnce(
      makeDetailRow([makeSessionRow({ minBuddies: null, participantCount: 0 })]),
    )

    const result = await getAdminTourDetail('tour-1')

    expect(result!.sessions[0].minBuddies).toBeNull()
    expect(result!.sessions[0].belowMinimum).toBe(false)
  })
})

// ── listAdminTours ──────────────────────────────────────────────────────────

describe('listAdminTours', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns sessions with minBuddies and belowMinimum derived from each row', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      makeListRow([makeSessionRow({ minBuddies: 4, participantCount: 1 })]),
    ])

    const result = await listAdminTours({})

    expect(result[0].sessions[0].minBuddies).toBe(4)
    expect(result[0].sessions[0].belowMinimum).toBe(true)
  })
})

describe('adminTour.service todos', () => {
  it.todo('updateTour throws TourNotFoundError when not found')
  it.todo('updateTour throws TourImmutableError when cancelled or completed')
  it.todo('transitionTourStatus throws TourTransitionError on invalid transition')
  it.todo('deleteTour throws TourNotDraftError when not in draft')
})
