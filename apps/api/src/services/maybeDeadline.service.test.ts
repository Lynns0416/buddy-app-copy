import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { Prisma } from '@prisma/client'

type MockFn = Mock<(...args: unknown[]) => unknown>
interface MockDb {
  tour: { findMany: MockFn }
  tourAdminAssignment: { findMany: MockFn }
  notificationDispatchLog: { create: MockFn }
  notificationJob: { createMany: MockFn; create: MockFn }
  $transaction: MockFn
}

vi.mock('../lib/db', () => {
  const mockDb: MockDb = {
    tour: { findMany: vi.fn() },
    tourAdminAssignment: { findMany: vi.fn() },
    notificationDispatchLog: { create: vi.fn() },
    notificationJob: { createMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  }
  return { db: mockDb }
})

import { db } from '../lib/db'
import { enqueueMaybeDeadlineMissed } from './maybeDeadline.service'

const mdb = db as unknown as MockDb

type TxnCallback = (tx: MockDb) => Promise<unknown>
const txnPassthrough = (fn: TxnCallback): unknown => fn(mdb)

beforeEach(() => {
  vi.clearAllMocks()
  mdb.$transaction.mockImplementation(txnPassthrough as (...args: unknown[]) => unknown)
  // Default: two assigned admins per tour. Returned by both
  // enqueueInAppForTourAdmins and enqueueEmailForTourAdmins.
  mdb.tourAdminAssignment.findMany.mockResolvedValue([
    {
      admin: {
        user: {
          id: 'a1',
          locale: 'ja',
          notificationPrefs: [
            { eventType: 'maybe_deadline_missed', emailEnabled: true, emailMode: 'immediate' },
          ],
        },
      },
    },
    {
      admin: {
        user: {
          id: 'a2',
          locale: 'en',
          notificationPrefs: [
            { eventType: 'maybe_deadline_missed', emailEnabled: true, emailMode: 'immediate' },
          ],
        },
      },
    },
  ])
})

type TourFindManyArgs = {
  where: {
    status: string
    maybeDeadline: { gte: Date; lt: Date }
    bookings: { some: { status: string } }
    adminAssignments: { some: { admin: { deletedAt: null } } }
  }
}
type LogCreateArg = { data: { eventKey: string } }

function logKeys(): string[] {
  return mdb.notificationDispatchLog.create.mock.calls.map(
    (c) => (c[0] as LogCreateArg).data.eventKey,
  )
}
function tourFindManyArgs(callIndex = 0): TourFindManyArgs {
  return mdb.tour.findMany.mock.calls[callIndex][0] as TourFindManyArgs
}

const NOW = new Date('2026-06-20T15:30:00Z')
const TOUR_DATE = new Date('2026-07-04T00:00:00Z')
// JST midnight 2026-06-21 == 2026-06-20T15:00:00Z
const TODAY_UTC = new Date(Date.UTC(2026, 5, 21))
const YESTERDAY_UTC = new Date(Date.UTC(2026, 5, 20))

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  })
}

describe('enqueueMaybeDeadlineMissed', () => {
  it('queries published tours with maybeDeadline in the JST yesterday window, with Maybe bookings and assigned admins', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])

    await enqueueMaybeDeadlineMissed(NOW)

    const { where } = tourFindManyArgs()
    expect(where.status).toBe('published')
    expect(where.maybeDeadline.gte.getTime()).toBe(YESTERDAY_UTC.getTime())
    expect(where.maybeDeadline.lt.getTime()).toBe(TODAY_UTC.getTime())
    expect(where.bookings.some.status).toBe('maybe')
    expect(where.adminAssignments.some.admin.deletedAt).toBeNull()
  })

  it('enqueues in-app + email to all assigned admins for each tour returned, with one dispatch log per tour', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([{ id: 't1', tourDate: TOUR_DATE, group: { name: 'Sakura School' } }])

    const result = await enqueueMaybeDeadlineMissed(NOW)

    expect(result).toEqual({ tours: 1, enqueuedTours: 1, alreadySent: 0 })
    expect(logKeys()).toEqual(['maybe_deadline_missed:t1'])
    // 2 calls: one for in-app helper, one for email helper. Each createMany inserts both admins.
    expect(mdb.notificationJob.createMany).toHaveBeenCalledTimes(2)
    const channels = mdb.notificationJob.createMany.mock.calls.flatMap(
      (c) => (c[0] as { data: { channel: string }[] }).data.map((d) => d.channel),
    )
    expect(channels.sort()).toEqual(['email', 'email', 'in_app', 'in_app'])
    // Slack is one row for the shared channel, not one per admin.
    expect(mdb.notificationJob.create).toHaveBeenCalledTimes(1)
    const slackRow = (mdb.notificationJob.create.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(slackRow).toMatchObject({ channel: 'slack', recipientUserId: null })
  })

  it('counts P2002 from the dispatch log as alreadySent and emits no jobs', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([{ id: 't1', tourDate: TOUR_DATE, group: { name: 'Sakura School' } }])

    mdb.$transaction.mockImplementationOnce((async (fn: TxnCallback) => {
      await fn({
        ...mdb,
        notificationDispatchLog: {
          create: vi.fn().mockRejectedValueOnce(p2002()),
        },
      })
    }) as (...args: unknown[]) => unknown)

    const result = await enqueueMaybeDeadlineMissed(NOW)

    expect(result).toEqual({ tours: 1, enqueuedTours: 0, alreadySent: 1 })
    expect(mdb.notificationJob.createMany).not.toHaveBeenCalled()
  })

  it('propagates non-P2002 errors from the transaction', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([{ id: 't1', tourDate: TOUR_DATE, group: { name: 'Sakura School' } }])

    const unexpected = new Error('connection lost')
    mdb.$transaction.mockImplementationOnce(() => Promise.reject(unexpected))

    await expect(enqueueMaybeDeadlineMissed(NOW)).rejects.toBe(unexpected)
  })

  it('returns zero counts when no tours match the window', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])

    const result = await enqueueMaybeDeadlineMissed(NOW)

    expect(result).toEqual({ tours: 0, enqueuedTours: 0, alreadySent: 0 })
    expect(mdb.$transaction).not.toHaveBeenCalled()
  })

  it('uses the current clock when called with no argument', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(NOW)
      mdb.tour.findMany.mockResolvedValueOnce([])

      await enqueueMaybeDeadlineMissed()

      expect(tourFindManyArgs().where.maybeDeadline.gte.getTime()).toBe(YESTERDAY_UTC.getTime())
      expect(tourFindManyArgs().where.maybeDeadline.lt.getTime()).toBe(TODAY_UTC.getTime())
    } finally {
      vi.useRealTimers()
    }
  })

  it('payload carries the tour id plus the group and date the message names', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([{ id: 't1', tourDate: TOUR_DATE, group: { name: 'Sakura School' } }])

    await enqueueMaybeDeadlineMissed(NOW)

    const rows = [
      ...mdb.notificationJob.createMany.mock.calls.flatMap(
        (c) => (c[0] as { data: { payload: Record<string, unknown>; eventType: string }[] }).data,
      ),
      ...mdb.notificationJob.create.mock.calls.map(
        (c) => (c[0] as { data: { payload: Record<string, unknown>; eventType: string } }).data,
      ),
    ]
    for (const d of rows) {
      expect(d.eventType).toBe('maybe_deadline_missed')
      expect(d.payload).toEqual({
        tourId: 't1',
        groupName: 'Sakura School',
        tourDate: '2026-07-04',
      })
    }
  })
})
