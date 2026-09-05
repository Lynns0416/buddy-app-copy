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
    user: { findUnique: vi.fn() },
    $transaction,
  }
  $transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(mockDb))
  return { db: mockDb }
})

vi.mock('../lib/email', () => ({
  sendEmail: vi.fn(),
}))

vi.mock('../lib/slack', () => ({
  sendSlack: vi.fn(),
}))

import { db } from '../lib/db'
import { sendEmail } from '../lib/email'
import { sendSlack } from '../lib/slack'
const mdb = db as unknown as MockDb & { user: { findUnique: import('vitest').Mock<(...args: unknown[]) => unknown> } }
const mockSendEmail = vi.mocked(sendEmail)
const mockSendSlack = vi.mocked(sendSlack)

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
    // Realistic failure: the webhook returns non-2xx and sendSlack throws.
    const job = jobFixture({
      attempts: 2,
      channel: 'slack',
      eventType: 'new_booking',
      recipientUserId: null,
      payload: { tourId: 't1' },
    })
    mockSendSlack.mockRejectedValueOnce(new Error('Slack send failed: 500 rollup_error'))
    mdb.notificationJob.findMany.mockResolvedValueOnce([{ id: job.id }])
    mdb.notificationJob.updateMany.mockResolvedValueOnce({ count: 1 })
    mdb.notificationJob.findUnique.mockResolvedValueOnce(job)

    const result = await dispatchPending()

    const update = (mdb.notificationJob.update.mock.calls[0][0] as any).data
    expect(update.status).toBe('pending')
    expect(update.lastError).toMatch(/Slack send failed: 500/)
    expect(update.scheduledFor).toBeInstanceOf(Date)
    // scheduledFor should be in the future (now + backoff)
    expect((update.scheduledFor as Date).getTime()).toBeGreaterThan(Date.now())
    expect(result).toMatchObject({ failed: 1, dead: 0 })
  })

  it('renders and sends a slack job, then marks it sent', async () => {
    const job = jobFixture({
      channel: 'slack',
      eventType: 'new_booking',
      recipientUserId: null,
      payload: { tourId: 't1' },
    })
    mdb.notificationJob.findMany.mockResolvedValueOnce([{ id: job.id }])
    mdb.notificationJob.updateMany.mockResolvedValueOnce({ count: 1 })
    mdb.notificationJob.findUnique.mockResolvedValueOnce(job)

    const result = await dispatchPending()

    expect(mockSendSlack).toHaveBeenCalledTimes(1)
    const arg = mockSendSlack.mock.calls[0][0] as { text: string }
    expect(arg.text).toContain('/admin/tours/t1')
    // No recipient lookup — slack jobs target a channel, not a user.
    expect(mdb.user.findUnique).not.toHaveBeenCalled()
    const update = (mdb.notificationJob.update.mock.calls[0][0] as any).data
    expect(update.status).toBe('sent')
    expect(update.sentAt).toBeInstanceOf(Date)
    expect(result.sent).toBe(1)
  })

  it('fails a slack job with no template instead of sending', async () => {
    const job = jobFixture({
      attempts: 2,
      channel: 'slack',
      eventType: 'tour_reminder',
      recipientUserId: null,
    })
    mdb.notificationJob.findMany.mockResolvedValueOnce([{ id: job.id }])
    mdb.notificationJob.updateMany.mockResolvedValueOnce({ count: 1 })
    mdb.notificationJob.findUnique.mockResolvedValueOnce(job)

    await dispatchPending()

    expect(mockSendSlack).not.toHaveBeenCalled()
    const update = (mdb.notificationJob.update.mock.calls[0][0] as any).data
    expect(update.lastError).toMatch(/no slack template/i)
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

  describe('email channel', () => {
    it('renders the template, calls sendEmail with the recipient address, and marks sent', async () => {
      const job = jobFixture({
        id: 'job-email-1',
        channel: 'email',
        eventType: 'account_approved',
        payload: {},
      })
      mdb.notificationJob.findMany.mockResolvedValueOnce([{ id: job.id }])
      mdb.notificationJob.updateMany.mockResolvedValueOnce({ count: 1 })
      mdb.notificationJob.findUnique.mockResolvedValueOnce(job)
      mdb.user.findUnique.mockResolvedValueOnce({ email: 'buddy@example.com' })

      const result = await dispatchPending()

      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      const arg = mockSendEmail.mock.calls[0][0] as { to: string; subject: string; html: string; text: string }
      expect(arg.to).toBe('buddy@example.com')
      expect(arg.subject.length).toBeGreaterThan(0)
      expect(arg.html.length).toBeGreaterThan(0)
      expect(result).toMatchObject({ sent: 1 })
    })

    it('fails when the recipient user is missing', async () => {
      const job = jobFixture({ channel: 'email', eventType: 'account_approved' })
      mdb.notificationJob.findMany.mockResolvedValueOnce([{ id: job.id }])
      mdb.notificationJob.updateMany.mockResolvedValueOnce({ count: 1 })
      mdb.notificationJob.findUnique.mockResolvedValueOnce(job)
      mdb.user.findUnique.mockResolvedValueOnce(null)

      const result = await dispatchPending()

      expect(mockSendEmail).not.toHaveBeenCalled()
      expect((mdb.notificationJob.update.mock.calls[0][0] as any).data.lastError).toMatch(/recipient not found/i)
      expect(result).toMatchObject({ failed: 1 })
    })

    it('fails when no email template is registered for the event', async () => {
      const job = jobFixture({ channel: 'email', eventType: 'new_signup' })
      mdb.notificationJob.findMany.mockResolvedValueOnce([{ id: job.id }])
      mdb.notificationJob.updateMany.mockResolvedValueOnce({ count: 1 })
      mdb.notificationJob.findUnique.mockResolvedValueOnce(job)
      mdb.user.findUnique.mockResolvedValueOnce({ email: 'admin@example.com' })

      const result = await dispatchPending()

      expect(mockSendEmail).not.toHaveBeenCalled()
      expect((mdb.notificationJob.update.mock.calls[0][0] as any).data.lastError).toMatch(/no email template/i)
      expect(result).toMatchObject({ failed: 1 })
    })

    it('fails when recipientUserId is missing on the job', async () => {
      const job = jobFixture({ channel: 'email', eventType: 'account_approved', recipientUserId: null })
      mdb.notificationJob.findMany.mockResolvedValueOnce([{ id: job.id }])
      mdb.notificationJob.updateMany.mockResolvedValueOnce({ count: 1 })
      mdb.notificationJob.findUnique.mockResolvedValueOnce(job)

      const result = await dispatchPending()

      expect(mockSendEmail).not.toHaveBeenCalled()
      expect((mdb.notificationJob.update.mock.calls[0][0] as any).data.lastError).toMatch(/missing recipientUserId/i)
      expect(result).toMatchObject({ failed: 1 })
    })

    it('marks failed when sendEmail throws', async () => {
      const job = jobFixture({ channel: 'email', eventType: 'account_approved' })
      mdb.notificationJob.findMany.mockResolvedValueOnce([{ id: job.id }])
      mdb.notificationJob.updateMany.mockResolvedValueOnce({ count: 1 })
      mdb.notificationJob.findUnique.mockResolvedValueOnce(job)
      mdb.user.findUnique.mockResolvedValueOnce({ email: 'buddy@example.com' })
      mockSendEmail.mockRejectedValueOnce(new Error('Gmail send failed: 503'))

      const result = await dispatchPending()

      expect((mdb.notificationJob.update.mock.calls[0][0] as any).data.lastError).toMatch(/Gmail send failed/i)
      expect(result).toMatchObject({ failed: 1, sent: 0 })
    })
  })
})
