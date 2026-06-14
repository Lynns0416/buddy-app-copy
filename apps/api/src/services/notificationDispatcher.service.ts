import { db } from '../lib/db'
import {
  NotificationChannelSchema,
  NotificationJobStatusSchema,
  type DispatchResult,
  type NotificationChannel,
} from '@peace-buddy/types'
import type { Prisma } from '@prisma/client'

const MAX_ATTEMPTS = 5
const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000] // 1m, 5m, 30m, 2h, 6h

type Job = {
  id: string
  channel: NotificationChannel
  eventType: string
  recipientUserId: string | null
  payload: Prisma.JsonValue
  attempts: number
  scheduledFor: Date
}

const jobSelect = {
  id: true,
  channel: true,
  eventType: true,
  recipientUserId: true,
  payload: true,
  attempts: true,
  scheduledFor: true,
} as const

export async function dispatchPending(limit = 100): Promise<DispatchResult> {
  const candidates = await db.notificationJob.findMany({
    where: {
      status: NotificationJobStatusSchema.enum.pending,
      scheduledFor: { lte: new Date() },
    },
    orderBy: { scheduledFor: 'asc' },
    take: limit,
    select: { id: true },
  })

  const result: DispatchResult = {
    picked: candidates.length,
    sent: 0,
    failed: 0,
    dead: 0,
    skipped: 0,
  }

  for (const { id } of candidates) {
    try {
      // Atomically claim the job by incrementing attempts. If another worker
      // already grabbed it (or its status changed), count===0 and we skip.
      const claim = await db.notificationJob.updateMany({
        where: { id, status: NotificationJobStatusSchema.enum.pending },
        data: { attempts: { increment: 1 } },
      })
      if (claim.count === 0) {
        result.skipped += 1
        continue
      }

      const job = await db.notificationJob.findUnique({ where: { id }, select: jobSelect })
      if (!job) {
        // Row disappeared between claim and read — shouldn't happen in practice
        // (FK constraints), but if it does, treat as a hard failure rather than
        // leaving the row orphaned with bumped attempts. There's nothing to
        // revert against, so just record and move on.
        result.skipped += 1
        continue
      }

      try {
        // Dispatch and mark sent atomically: the channel write and the status
        // update must commit together, or a successful dispatch followed by a
        // failed status update would cause duplicate delivery on retry.
        await db.$transaction(async (tx) => {
          await dispatchOne(job, tx)
          await tx.notificationJob.update({
            where: { id: job.id },
            data: {
              status: NotificationJobStatusSchema.enum.sent,
              sentAt: new Date(),
              lastError: null,
            },
          })
        })
        result.sent += 1
      } catch (err) {
        const isDead = job.attempts >= MAX_ATTEMPTS
        const backoffIndex = Math.max(0, Math.min(job.attempts - 1, BACKOFF_MS.length - 1))
        const nextDelay = BACKOFF_MS[backoffIndex]
        await db.notificationJob.update({
          where: { id: job.id },
          data: {
            status: isDead ? NotificationJobStatusSchema.enum.dead : NotificationJobStatusSchema.enum.pending,
            lastError: err instanceof Error ? err.message.slice(0, 1000) : String(err).slice(0, 1000),
            scheduledFor: isDead ? job.scheduledFor : new Date(Date.now() + nextDelay),
          },
        })
        if (isDead) result.dead += 1
        else result.failed += 1
      }
    } catch (err) {
      // Reach here only if the claim, the post-claim read, or the failure-path
      // status update itself threw (transient DB / connection issue). Log so
      // operators can tell this apart from "another worker claimed it".
      console.error('[notificationDispatcher] iteration failed', { jobId: id, err })
      result.skipped += 1
    }
  }

  return result
}

async function dispatchOne(job: Job, tx: Prisma.TransactionClient): Promise<void> {
  switch (job.channel) {
    case NotificationChannelSchema.enum.in_app:
      await dispatchInApp(job, tx)
      return
    case NotificationChannelSchema.enum.email:
      throw new Error('email channel not yet implemented')
    case NotificationChannelSchema.enum.slack:
      throw new Error('slack channel not yet implemented')
  }
}

async function dispatchInApp(job: Job, tx: Prisma.TransactionClient): Promise<void> {
  if (!job.recipientUserId) {
    throw new Error('in_app job missing recipientUserId')
  }
  await tx.notification.create({
    data: {
      userId: job.recipientUserId,
      type: job.eventType,
      payload: job.payload as Prisma.InputJsonValue,
    },
  })
}
