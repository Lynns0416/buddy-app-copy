/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
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
import { enqueueTourReminders } from './tourReminder.service'

const mdb = db as unknown as MockDb

type TxnCallback = (tx: MockDb) => unknown
// Runs the txn callback against the same mock db (matches notificationDispatcher tests).
const txnPassthrough = (fn: TxnCallback): unknown => fn(mdb)

beforeEach(() => {
  vi.clearAllMocks()
  mdb.$transaction.mockImplementation(txnPassthrough as unknown as (...args: unknown[]) => unknown)
  // Default: dispatchLog insert succeeds, no email recipient lookup magic.
  mdb.user.findUnique.mockResolvedValue({ locale: 'ja' })
})

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

// 2026-06-21T00:30:00+09:00 (JST) — picked so the JST day is 2026-06-21
// regardless of how the host machine interprets midnight.
const NOW = new Date('2026-06-20T15:30:00Z')
const TODAY_UTC = new Date(Date.UTC(2026, 5, 21))
const THREE_DAYS_OUT = new Date(Date.UTC(2026, 5, 24))
const TEN_DAYS_OUT = new Date(Date.UTC(2026, 6, 1))

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  })
}

describe('enqueueTourReminders', () => {
  it('queries published tours from today onward', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])

    await enqueueTourReminders(NOW)

    const where = (mdb.tour.findMany.mock.calls[0][0] as any).where
    expect(where.status).toBe('published')
    expect((where.tourDate.gte as Date).getTime()).toBe(TODAY_UTC.getTime())
  })

  it('enqueues in-app + email per buddy when an offset matches today (JST)', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', tourDate: THREE_DAYS_OUT, notificationOffsets: [3, 1], group: { name: 'Sakura School' } },
    ])
    mdb.booking.findMany.mockResolvedValueOnce([
      { buddy: { userId: 'u1' } },
      { buddy: { userId: 'u2' } },
    ])

    const result = await enqueueTourReminders(NOW)

    expect(result).toEqual({ tours: 1, considered: 2, enqueued: 2, alreadySent: 0 })

    // Two dispatch-log inserts (one per buddy) for the matching offset 3.
    expect(mdb.notificationDispatchLog.create).toHaveBeenCalledTimes(2)
    expect(logKeys()).toEqual([
      'tour_reminder:t1:3:u1',
      'tour_reminder:t1:3:u2',
    ])

    // Two in-app + two email = 4 NotificationJob inserts.
    expect(mdb.notificationJob.create).toHaveBeenCalledTimes(4)
    const rows = jobData()
    expect(rows.map((d) => d.channel).sort()).toEqual(['email', 'email', 'in_app', 'in_app'])
    // Every enqueued job carries the tour scope + the offset that triggered it.
    for (const d of rows) {
      expect(d.eventType).toBe('tour_reminder')
      expect(d.payload).toEqual({
        tourId: 't1',
        groupName: 'Sakura School',
        tourDate: '2026-06-24', // THREE_DAYS_OUT
        offsetDays: 3,
      })
    }
  })

  it('skips offsets whose trigger date is not today', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', tourDate: TEN_DAYS_OUT, notificationOffsets: [3, 1], group: { name: 'Sakura School' } },
    ])

    const result = await enqueueTourReminders(NOW)

    expect(result).toEqual({ tours: 0, considered: 0, enqueued: 0, alreadySent: 0 })
    expect(mdb.booking.findMany).not.toHaveBeenCalled()
    expect(mdb.notificationDispatchLog.create).not.toHaveBeenCalled()
  })

  it('dedups recipients booked across multiple sessions of the same tour', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', tourDate: THREE_DAYS_OUT, notificationOffsets: [3], group: { name: 'Sakura School' } },
    ])
    mdb.booking.findMany.mockResolvedValueOnce([
      { buddy: { userId: 'u1' } },
      { buddy: { userId: 'u1' } }, // same buddy, two sessions
      { buddy: { userId: 'u2' } },
    ])

    const result = await enqueueTourReminders(NOW)

    expect(result.enqueued).toBe(2)
    expect(mdb.notificationDispatchLog.create).toHaveBeenCalledTimes(2)
  })

  it('counts P2002 from the dispatch log as alreadySent and skips enqueue', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', tourDate: THREE_DAYS_OUT, notificationOffsets: [3], group: { name: 'Sakura School' } },
    ])
    mdb.booking.findMany.mockResolvedValueOnce([{ buddy: { userId: 'u1' } }])

    mdb.$transaction.mockImplementationOnce(async (fn: any) => {
      // simulate unique constraint hit on the log insert by throwing P2002
      await fn({
        ...mdb,
        notificationDispatchLog: {
          create: vi.fn().mockRejectedValueOnce(p2002()),
        },
      })
    })

    const result = await enqueueTourReminders(NOW)

    expect(result.enqueued).toBe(0)
    expect(result.alreadySent).toBe(1)
    expect(mdb.notificationJob.create).not.toHaveBeenCalled()
  })

  it('filters bookings to confirmed / maybe / waitlist statuses only', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', tourDate: THREE_DAYS_OUT, notificationOffsets: [3], group: { name: 'Sakura School' } },
    ])
    mdb.booking.findMany.mockResolvedValueOnce([])

    await enqueueTourReminders(NOW)

    const where = (mdb.booking.findMany.mock.calls[0][0] as any).where
    expect(where.status.in).toEqual(['confirmed', 'maybe', 'waitlist'])
    expect(where.buddy.status.notIn).toEqual(['suspended', 'rejected'])
  })

  it('fires reminders for multiple tours that each match today on a different offset', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', tourDate: TEN_DAYS_OUT, notificationOffsets: [10], group: { name: 'Sakura School' } },
      { id: 't2', tourDate: THREE_DAYS_OUT, notificationOffsets: [3], group: { name: 'Sakura School' } },
    ])
    mdb.booking.findMany.mockResolvedValueOnce([{ buddy: { userId: 'u1' } }])
    mdb.booking.findMany.mockResolvedValueOnce([{ buddy: { userId: 'u2' } }])

    const result = await enqueueTourReminders(NOW)

    expect(result.tours).toBe(2)
    expect(result.enqueued).toBe(2)
    expect(logKeys().sort()).toEqual([
      'tour_reminder:t1:10:u1',
      'tour_reminder:t2:3:u2',
    ])
  })

  it('is a no-op for a tour with an empty notificationOffsets array', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', tourDate: THREE_DAYS_OUT, notificationOffsets: [], group: { name: 'Sakura School' } },
    ])

    const result = await enqueueTourReminders(NOW)

    expect(result).toEqual({ tours: 0, considered: 0, enqueued: 0, alreadySent: 0 })
    expect(mdb.booking.findMany).not.toHaveBeenCalled()
    expect(mdb.notificationDispatchLog.create).not.toHaveBeenCalled()
  })

  it('propagates non-P2002 errors raised inside the enqueue txn', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([
      { id: 't1', tourDate: THREE_DAYS_OUT, notificationOffsets: [3], group: { name: 'Sakura School' } },
    ])
    mdb.booking.findMany.mockResolvedValueOnce([{ buddy: { userId: 'u1' } }])

    const unexpected = new Error('connection lost')
    mdb.$transaction.mockImplementationOnce(() => Promise.reject(unexpected))

    await expect(enqueueTourReminders(NOW)).rejects.toBe(unexpected)
  })

  it('uses the current clock when called with no argument', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(NOW)
      mdb.tour.findMany.mockResolvedValueOnce([])

      await enqueueTourReminders()

      const gte = (mdb.tour.findMany.mock.calls[0][0] as any).where.tourDate.gte as Date
      expect(gte.getTime()).toBe(TODAY_UTC.getTime())
    } finally {
      vi.useRealTimers()
    }
  })
})
