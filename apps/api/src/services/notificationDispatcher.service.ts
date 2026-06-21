import { db } from '../lib/db'
import {
  NotificationChannelSchema,
  NotificationJobStatusSchema,
  type DispatchResult,
  type Locale,
  type NotifEventKind,
  type NotificationChannel,
} from '@peace-buddy/types'
import type { Prisma } from '@prisma/client'
import { sendEmail } from '../lib/email'
import { renderEmail } from './notificationTemplates'

const MAX_ATTEMPTS = 5
const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000] // 1m, 5m, 30m, 2h, 6h

type Job = {
  id: string
  channel: NotificationChannel
  eventType: string
  recipientUserId: string | null
  payload: Prisma.JsonValue
  locale: Locale
  attempts: number
  scheduledFor: Date
}

const jobSelect = {
  id: true,
  channel: true,
  eventType: true,
  recipientUserId: true,
  payload: true,
  locale: true,
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
    select: { id: true, attempts: true },
  })

  const result: DispatchResult = {
    picked: candidates.length,
    sent: 0,
    failed: 0,
    dead: 0,
    skipped: 0,
  }

  for (const { id, attempts: prevAttempts } of candidates) {
    try {
      // CAS claim: gate the increment on the attempts value we read with the
      // candidate. Two workers reading the same row both pass the status check,
      // but only the first updateMany matches the attempts version; the second
      // sees count===0 and skips.
      const claim = await db.notificationJob.updateMany({
        where: {
          id,
          status: NotificationJobStatusSchema.enum.pending,
          attempts: prevAttempts,
        },
        data: { attempts: { increment: 1 } },
      })
      if (claim.count === 0) {
        result.skipped += 1
        continue
      }

      const job = await db.notificationJob.findUnique({ where: { id }, select: jobSelect })
      if (!job) {
        result.skipped += 1
        continue
      }

      try {
        await dispatchAndComplete(job)
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
      console.error('[notificationDispatcher] iteration failed', { jobId: id, err })
      result.skipped += 1
    }
  }

  return result
}

async function dispatchAndComplete(job: Job): Promise<void> {
  const sentPatch = {
    status: NotificationJobStatusSchema.enum.sent,
    sentAt: new Date(),
    lastError: null,
  }
  switch (job.channel) {
    case NotificationChannelSchema.enum.in_app:
      // In-app write + status flip commit together so a failed status update
      // can't cause a duplicate Notification row on retry. Safe to keep in a
      // txn because both operations are DB-local.
      await db.$transaction(async (tx) => {
        await dispatchInApp(job, tx)
        await tx.notificationJob.update({ where: { id: job.id }, data: sentPatch })
      })
      return
    case NotificationChannelSchema.enum.email:
      // Send first, then mark sent. A send is not reversible, so wrapping it
      // in a txn buys nothing and would hold the DB connection across the
      // HTTPS round-trip. On a status-update failure here, the next sweep can
      // re-deliver — narrow window, same as every queue.
      await dispatchEmail(job)
      await db.notificationJob.update({ where: { id: job.id }, data: sentPatch })
      return
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

async function dispatchEmail(job: Job): Promise<void> {
  if (!job.recipientUserId) {
    throw new Error('email job missing recipientUserId')
  }
  const recipient = await db.user.findUnique({
    where: { id: job.recipientUserId },
    select: { email: true },
  })
  if (!recipient) {
    throw new Error('email recipient not found')
  }

  const rendered = renderEmail(
    job.eventType as NotifEventKind,
    (job.payload ?? {}) as Record<string, unknown>,
    job.locale,
  )
  if (!rendered) {
    throw new Error(`no email template for event '${job.eventType}'`)
  }

  await sendEmail({ to: recipient.email, ...rendered })
}
