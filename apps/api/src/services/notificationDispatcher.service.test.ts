/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { dispatchPending } from './notificationDispatcher.service'

type MockFn = Mock<(...args: unknown[]) => unknown>
interface MockDb {
  notificationJob: {
    findMany: MockFn
    updateMany: MockFn
    findUnique: MockFn
    update: MockFn
  }
  notification: { create: MockFn }
  $transaction: MockFn
}

vi.mock('../lib/db', () => {
  const $transaction = vi.fn()
  const mockDb = {
    notificationJob: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    notification: { create: vi.fn() },
    $transaction,
  }
  $transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(mockDb))
  return { db: mockDb }
})

import { db } from '../lib/db'
const mdb = db as unknown as MockDb

beforeEach(() => vi.clearAllMocks())

function jobFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'job-1',
    channel: 'in_app',
    eventType: 'account_approved',
    recipientUserId: 'u1',
    payload: { foo: 1 },
    locale: 'ja',
    status: 'pending',
    attempts: 1,
    scheduledFor: new Date('2026-06-01'),
    sentAt: null,
    lastError: null,
    createdAt: new Date('2026-06-01'),
    updatedAt: new Date('2026-06-01'),
    ...overrides,
  }
}

describe('dispatchPending', () => {
  it('returns zeros when no pending jobs', async () => {
    mdb.notificationJob.findMany.mockResolvedValueOnce([])
    const result = await dispatchPending()
    expect(result).toEqual({ picked: 0, sent: 0, failed: 0, dead: 0, skipped: 0 })
  })

  it('picks only pending jobs scheduled in the past', async () => {
    mdb.notificationJob.findMany.mockResolvedValueOnce([])
    await dispatchPending()
    const where = (mdb.notificationJob.findMany.mock.calls[0][0] as any).where
    expect(where.status).toBe('pending')
    expect(where.scheduledFor).toEqual({ lte: expect.any(Date) })
  })

  it('writes a Notification row for in_app jobs and marks them sent', async () => {
    const job = jobFixture()
    mdb.notificationJob.findMany.mockResolvedValueOnce([{ id: job.id }])
    mdb.notificationJob.updateMany.mockResolvedValueOnce({ count: 1 })
    mdb.notificationJob.findUnique.mockResolvedValueOnce(job)

    const result = await dispatchPending()

    expect(mdb.notification.create).toHaveBeenCalledWith({
      data: { userId: 'u1', type: 'account_approved', payload: { foo: 1 } },
    })
    expect(mdb.notificationJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: 'sent', lastError: null }),
      }),
    )
    expect(result).toMatchObject({ picked: 1, sent: 1, failed: 0, dead: 0, skipped: 0 })
  })

  it('skips when another worker claimed the job (claim count 0)', async () => {
    mdb.notificationJob.findMany.mockResolvedValueOnce([{ id: 'job-1' }])
    mdb.notificationJob.updateMany.mockResolvedValueOnce({ count: 0 })

    const result = await dispatchPending()

    expect(mdb.notificationJob.findUnique).not.toHaveBeenCalled()
    expect(mdb.notification.create).not.toHaveBeenCalled()
    expect(result).toMatchObject({ picked: 1, sent: 0, skipped: 1 })
  })

  it('marks failed with backoff when dispatch throws and attempts < max', async () => {
    const job = jobFixture({ attempts: 2, channel: 'email' })
    mdb.notificationJob.findMany.mockResolvedValueOnce([{ id: job.id }])
    mdb.notificationJob.updateMany.mockResolvedValueOnce({ count: 1 })
    mdb.notificationJob.findUnique.mockResolvedValueOnce(job)

    const result = await dispatchPending()

    const update = (mdb.notificationJob.update.mock.calls[0][0] as any).data
    expect(update.status).toBe('pending')
    expect(update.lastError).toMatch(/email channel not yet implemented/i)
    expect(update.scheduledFor).toBeInstanceOf(Date)
    // scheduledFor should be in the future (now + backoff)
    expect((update.scheduledFor as Date).getTime()).toBeGreaterThan(Date.now())
    expect(result).toMatchObject({ failed: 1, dead: 0 })
  })

  it('marks dead when attempts have already reached MAX_ATTEMPTS (5)', async () => {
    // The dispatcher increments attempts via updateMany then refetches; the refetched
    // attempts is the post-increment value. attempts >= 5 → dead.
    const job = jobFixture({ attempts: 5, channel: 'slack' })
    mdb.notificationJob.findMany.mockResolvedValueOnce([{ id: job.id }])
    mdb.notificationJob.updateMany.mockResolvedValueOnce({ count: 1 })
    mdb.notificationJob.findUnique.mockResolvedValueOnce(job)

    const result = await dispatchPending()

    const update = (mdb.notificationJob.update.mock.calls[0][0] as any).data
    expect(update.status).toBe('dead')
    // dead jobs keep their original scheduledFor (no further reschedule)
    expect(update.scheduledFor).toBe(job.scheduledFor)
    expect(result).toMatchObject({ dead: 1, failed: 0 })
  })

  it('treats in_app jobs missing recipientUserId as failures', async () => {
    const job = jobFixture({ recipientUserId: null })
    mdb.notificationJob.findMany.mockResolvedValueOnce([{ id: job.id }])
    mdb.notificationJob.updateMany.mockResolvedValueOnce({ count: 1 })
    mdb.notificationJob.findUnique.mockResolvedValueOnce(job)

    const result = await dispatchPending()

    expect(mdb.notification.create).not.toHaveBeenCalled()
    expect((mdb.notificationJob.update.mock.calls[0][0] as any).data.lastError).toMatch(
      /recipientUserId/,
    )
    expect(result).toMatchObject({ failed: 1 })
  })

  it('truncates lastError to 1000 chars', async () => {
    const job = jobFixture()
    mdb.notificationJob.findMany.mockResolvedValueOnce([{ id: job.id }])
    mdb.notificationJob.updateMany.mockResolvedValueOnce({ count: 1 })
    mdb.notificationJob.findUnique.mockResolvedValueOnce(job)
    mdb.notification.create.mockRejectedValueOnce(new Error('x'.repeat(2000)))

    await dispatchPending()

    const update = (mdb.notificationJob.update.mock.calls[0][0] as any).data
    expect(update.lastError.length).toBe(1000)
  })

  it('respects the limit param when fetching candidates', async () => {
    mdb.notificationJob.findMany.mockResolvedValueOnce([])
    await dispatchPending(7)
    expect((mdb.notificationJob.findMany.mock.calls[0][0] as any).take).toBe(7)
  })
})
