import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { Prisma } from '@prisma/client'

type MockFn = Mock<(...args: unknown[]) => unknown>
interface MockDb {
  tour: { findMany: MockFn }
  booking: { findMany: MockFn }
  user: { findUnique: MockFn }
  notificationDispatchLog: { create: MockFn }
  notificationJob: { create: MockFn; createMany: MockFn }
  $transaction: MockFn
}

vi.mock('../lib/db', () => {
  const mockDb: MockDb = {
    tour: { findMany: vi.fn() },
    booking: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    notificationDispatchLog: { create: vi.fn() },
    notificationJob: { create: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  }
  return { db: mockDb }
})

import { db } from '../lib/db'
import { enqueueMaybeReminders } from './maybeReminder.service'

const mdb = db as unknown as MockDb

type TxnCallback = (tx: MockDb) => Promise<unknown>
const txnPassthrough = (fn: TxnCallback): unknown => fn(mdb)

beforeEach(() => {
  vi.clearAllMocks()
  mdb.$transaction.mockImplementation(txnPassthrough as (...args: unknown[]) => unknown)
  mdb.user.findUnique.mockResolvedValue({ locale: 'ja' })
})

type TourFindManyArgs = { where: { status: string; maybeDeadline: { gte: Date } } }
type BookingFindManyArgs = { where: { tourId: string; status: string } }
type LogCreateArg = { data: { eventKey: string } }
type JobCreateArg = { data: { channel: string; eventType: string; payload: Record<string, unknown> } }

function logKeys(): string[] {
  return mdb.notificationDispatchLog.create.mock.calls.map(
    (c) => (c[0] as LogCreateArg).data.eventKey,
  )
}
function jobData(): JobCreateArg['data'][] {
  return mdb.notificationJob.create.mock.calls.map((c) => (c[0] as JobCreateArg).data)
}
function tourFindManyArgs(callIndex = 0): TourFindManyArgs {
  return mdb.tour.findMany.mock.calls[callIndex][0] as TourFindManyArgs
}
function bookingFindManyArgs(callIndex = 0): BookingFindManyArgs {
  return mdb.booking.findMany.mock.calls[callIndex][0] as BookingFindManyArgs
}

const NOW = new Date('2026-06-20T15:30:00Z')
const TODAY_UTC = new Date(Date.UTC(2026, 5, 21))
const ONE_DAY_OUT = new Date(Date.UTC(2026, 5, 22))
const THREE_DAYS_OUT = new Date(Date.UTC(2026, 5, 24))
const TEN_DAYS_OUT = new Date(Date.UTC(2026, 6, 1))
const YESTERDAY = new Date(Date.UTC(2026, 5, 20))

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  })
}

describe('enqueueMaybeReminders', () => {
  it('queries published tours with maybeDeadline from today onward', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])

    await enqueueMaybeReminders(NOW)

    const { where } = tourFindManyArgs()
    expect(where.status).toBe('published')
    expect(where.maybeDeadline.gte.getTime()).toBe(TODAY_UTC.getTime())
  })

  it('enqueues in-app + email per Maybe buddy when offset 3 matches today', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', maybeDeadline: THREE_DAYS_OUT },
    ])
    mdb.booking.findMany.mockResolvedValueOnce([
      { buddy: { userId: 'u1' } },
      { buddy: { userId: 'u2' } },
    ])

    const result = await enqueueMaybeReminders(NOW)

    expect(result).toEqual({ tours: 1, considered: 2, enqueued: 2, alreadySent: 0 })
    expect(logKeys()).toEqual([
      'maybe_reminder:t1:3:u1',
      'maybe_reminder:t1:3:u2',
    ])
    expect(mdb.notificationJob.create).toHaveBeenCalledTimes(4)
    const rows = jobData()
    expect(rows.map((d) => d.channel).sort()).toEqual(['email', 'email', 'in_app', 'in_app'])
    for (const d of rows) {
      expect(d.eventType).toBe('maybe_reminder')
      expect(d.payload).toEqual({ tourId: 't1', offsetDays: 3 })
    }
  })

  it('fires offset 1 when deadline is tomorrow (JST)', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', maybeDeadline: ONE_DAY_OUT },
    ])
    mdb.booking.findMany.mockResolvedValueOnce([{ buddy: { userId: 'u1' } }])

    const result = await enqueueMaybeReminders(NOW)

    expect(result.enqueued).toBe(1)
    expect(logKeys()).toEqual(['maybe_reminder:t1:1:u1'])
  })

  it('skips tours whose deadline does not match any offset today', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', maybeDeadline: TEN_DAYS_OUT },
    ])

    const result = await enqueueMaybeReminders(NOW)

    expect(result).toEqual({ tours: 0, considered: 0, enqueued: 0, alreadySent: 0 })
    expect(mdb.booking.findMany).not.toHaveBeenCalled()
  })

  it('skips tours with null maybeDeadline returned by Prisma', async () => {
    // The `gte: today` filter excludes nulls in the query, but guard in code too.
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', maybeDeadline: null },
    ])

    const result = await enqueueMaybeReminders(NOW)

    expect(result).toEqual({ tours: 0, considered: 0, enqueued: 0, alreadySent: 0 })
    expect(mdb.booking.findMany).not.toHaveBeenCalled()
  })

  it('skips tours whose deadline is already in the past', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', maybeDeadline: YESTERDAY },
    ])

    const result = await enqueueMaybeReminders(NOW)

    expect(result).toEqual({ tours: 0, considered: 0, enqueued: 0, alreadySent: 0 })
    expect(mdb.booking.findMany).not.toHaveBeenCalled()
  })

  it('dedups buddies holding Maybe on multiple sessions of the same tour', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', maybeDeadline: THREE_DAYS_OUT },
    ])
    mdb.booking.findMany.mockResolvedValueOnce([
      { buddy: { userId: 'u1' } },
      { buddy: { userId: 'u1' } },
      { buddy: { userId: 'u2' } },
    ])

    const result = await enqueueMaybeReminders(NOW)

    expect(result.enqueued).toBe(2)
    expect(mdb.notificationDispatchLog.create).toHaveBeenCalledTimes(2)
  })

  it('filters bookings to Maybe status only', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', maybeDeadline: THREE_DAYS_OUT },
    ])
    mdb.booking.findMany.mockResolvedValueOnce([])

    await enqueueMaybeReminders(NOW)

    const { where } = bookingFindManyArgs()
    expect(where.status).toBe('maybe')
  })

  it('excludes suspended and rejected buddies via the booking-side relation filter', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', maybeDeadline: THREE_DAYS_OUT },
    ])
    mdb.booking.findMany.mockResolvedValueOnce([])

    await enqueueMaybeReminders(NOW)

    const args = bookingFindManyArgs() as BookingFindManyArgs & {
      where: { buddy: { status: { notIn: string[] } } }
    }
    expect(args.where.buddy.status.notIn).toEqual(['suspended', 'rejected'])
  })

  it('counts P2002 from the dispatch log as alreadySent and skips enqueue', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', maybeDeadline: THREE_DAYS_OUT },
    ])
    mdb.booking.findMany.mockResolvedValueOnce([{ buddy: { userId: 'u1' } }])

    mdb.$transaction.mockImplementationOnce((async (fn: TxnCallback) => {
      await fn({
        ...mdb,
        notificationDispatchLog: {
          create: vi.fn().mockRejectedValueOnce(p2002()),
        },
      })
    }) as (...args: unknown[]) => unknown)

    const result = await enqueueMaybeReminders(NOW)

    expect(result.enqueued).toBe(0)
    expect(result.alreadySent).toBe(1)
    expect(mdb.notificationJob.create).not.toHaveBeenCalled()
  })

  it('propagates non-P2002 errors raised inside the enqueue txn', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', maybeDeadline: THREE_DAYS_OUT },
    ])
    mdb.booking.findMany.mockResolvedValueOnce([{ buddy: { userId: 'u1' } }])

    const unexpected = new Error('connection lost')
    mdb.$transaction.mockImplementationOnce(() => Promise.reject(unexpected))

    await expect(enqueueMaybeReminders(NOW)).rejects.toBe(unexpected)
  })

  it('uses the current clock when called with no argument', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(NOW)
      mdb.tour.findMany.mockResolvedValueOnce([])

      await enqueueMaybeReminders()

      expect(tourFindManyArgs().where.maybeDeadline.gte.getTime()).toBe(TODAY_UTC.getTime())
    } finally {
      vi.useRealTimers()
    }
  })
})
