/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import {
  enqueueEmail,
  enqueueEmailForActiveBuddies,
  enqueueEmailForBookedBuddies,
  enqueueEmailForTourAdmins,
  enqueueInApp,
  enqueueInAppForAllAdmins,
  enqueueInAppForTourAdmins,
  enqueueSlackForAdmins,
  listNotifications,
  countUnread,
  markRead,
} from './notification.service'

type MockFn = Mock<(...args: unknown[]) => unknown>
interface MockDb {
  user: { findUnique: MockFn; findMany: MockFn }
  notificationJob: { create: MockFn; createMany: MockFn }
  tourAdminAssignment: { findMany: MockFn }
  buddyProfile: { findMany: MockFn }
  booking: { findMany: MockFn }
  notification: { findMany: MockFn; count: MockFn; updateMany: MockFn }
}

vi.mock('../lib/db', () => {
  const mockDb = {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    notificationJob: { create: vi.fn(), createMany: vi.fn() },
    tourAdminAssignment: { findMany: vi.fn() },
    buddyProfile: { findMany: vi.fn() },
    booking: { findMany: vi.fn() },
    notification: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  }
  return { db: mockDb }
})

import { db } from '../lib/db'

// These tests exercise recipient fan-out and preference gating, not message
// content — but every event's payload is typed now, so the fixtures have to be
// complete. One per payload shape.
const tourPayload = { tourId: 'tour-1', groupName: 'Sakura School', tourDate: '2026-07-04' }
const reminderPayload = { ...tourPayload, offsetDays: 3 }
const bookingPayload = {
  ...tourPayload,
  bookingId: 'b1',
  sessionId: 's1',
  buddyId: 'bd1',
  buddyName: 'Aya',
}
const newBookingPayload = { ...bookingPayload, status: 'confirmed' as const }
const cantGoPayload = { ...bookingPayload, category: 'health' as const }
const signupPayload = { buddyUserId: 'u-new', email: 'new@example.test', displayName: 'Aya' }
const mdb = db as unknown as MockDb

beforeEach(() => vi.clearAllMocks())

describe('enqueueInApp', () => {
  it('writes a NotificationJob row with recipient locale snapshot', async () => {
    mdb.user.findUnique.mockResolvedValueOnce({ locale: 'en' })
    await enqueueInApp(
      { eventType: 'account_approved', recipientUserId: 'u1', payload: { foo: 1 } },
      mdb as any,
    )

    expect(mdb.notificationJob.create).toHaveBeenCalledTimes(1)
    const data = (mdb.notificationJob.create.mock.calls[0][0] as any).data
    expect(data).toMatchObject({
      channel: 'in_app',
      eventType: 'account_approved',
      recipientUserId: 'u1',
      payload: { foo: 1 },
      locale: 'en',
    })
    expect(data.scheduledFor).toBeInstanceOf(Date)
  })

  it('silently drops when the recipient does not exist', async () => {
    mdb.user.findUnique.mockResolvedValueOnce(null)
    await enqueueInApp(
      { eventType: 'account_approved', recipientUserId: 'missing', payload: {} },
      mdb as any,
    )
    expect(mdb.notificationJob.create).not.toHaveBeenCalled()
  })

  it('honors scheduledFor when given', async () => {
    mdb.user.findUnique.mockResolvedValueOnce({ locale: 'ja' })
    const when = new Date('2026-06-15T09:00:00Z')
    await enqueueInApp(
      { eventType: 'tour_reminder', recipientUserId: 'u1', payload: reminderPayload, scheduledFor: when },
      mdb as any,
    )
    expect((mdb.notificationJob.create.mock.calls[0][0] as any).data.scheduledFor).toBe(when)
  })
})

describe('enqueueInAppForAllAdmins', () => {
  it('fans out to every active admin, one row per admin', async () => {
    mdb.user.findMany.mockResolvedValueOnce([
      { id: 'a1', locale: 'ja' },
      { id: 'a2', locale: 'en' },
    ])

    await enqueueInAppForAllAdmins(
      { eventType: 'new_signup', payload: signupPayload },
      mdb as any,
    )

    expect(mdb.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { in: ['admin', 'super_admin'] },
          adminProfile: { deletedAt: null },
        }),
      }),
    )
    const data = (mdb.notificationJob.createMany.mock.calls[0][0] as any).data
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({ recipientUserId: 'a1', locale: 'ja', eventType: 'new_signup' })
    expect(data[1]).toMatchObject({ recipientUserId: 'a2', locale: 'en' })
  })

  it('no-ops when there are no admins', async () => {
    mdb.user.findMany.mockResolvedValueOnce([])
    await enqueueInAppForAllAdmins({ eventType: 'new_signup', payload: signupPayload }, mdb as any)
    expect(mdb.notificationJob.createMany).not.toHaveBeenCalled()
  })
})

describe('enqueueInAppForTourAdmins', () => {
  it('fans out only to admins assigned to the tour', async () => {
    mdb.tourAdminAssignment.findMany.mockResolvedValueOnce([
      { admin: { user: { id: 'a1', locale: 'ja' } } },
      { admin: { user: { id: 'a2', locale: 'en' } } },
    ])

    await enqueueInAppForTourAdmins(
      'tour-1',
      { eventType: 'new_booking', payload: newBookingPayload },
      mdb as any,
    )

    expect(mdb.tourAdminAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tourId: 'tour-1', admin: { deletedAt: null } } }),
    )
    const data = (mdb.notificationJob.createMany.mock.calls[0][0] as any).data as Array<{ recipientUserId: string }>
    expect(data).toHaveLength(2)
    expect(data.map((d) => d.recipientUserId)).toEqual(['a1', 'a2'])
  })

  it('no-ops when the tour has no assigned admins (PRD §10.2)', async () => {
    mdb.tourAdminAssignment.findMany.mockResolvedValueOnce([])
    await enqueueInAppForTourAdmins(
      'tour-1',
      { eventType: 'new_booking', payload: newBookingPayload },
      mdb as any,
    )
    expect(mdb.notificationJob.createMany).not.toHaveBeenCalled()
  })
})

describe('listNotifications', () => {
  it('returns latest first, ISO-serialized dates', async () => {
    mdb.notification.findMany.mockResolvedValueOnce([
      {
        id: 'n1',
        type: 'account_approved',
        payload: { foo: 1 },
        readAt: null,
        createdAt: new Date('2026-06-01T10:00:00Z'),
      },
      {
        id: 'n2',
        type: 'new_booking',
        payload: {},
        readAt: new Date('2026-06-02T11:00:00Z'),
        createdAt: new Date('2026-05-30T09:00:00Z'),
      },
    ])

    const result = await listNotifications('u1')
    expect(mdb.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    )
    expect(result).toEqual([
      {
        id: 'n1',
        type: 'account_approved',
        payload: { foo: 1 },
        readAt: null,
        createdAt: '2026-06-01T10:00:00.000Z',
      },
      {
        id: 'n2',
        type: 'new_booking',
        payload: {},
        readAt: '2026-06-02T11:00:00.000Z',
        createdAt: '2026-05-30T09:00:00.000Z',
      },
    ])
  })

  it('honors limit override', async () => {
    mdb.notification.findMany.mockResolvedValueOnce([])
    await listNotifications('u1', 5)
    expect((mdb.notification.findMany.mock.calls[0][0] as any).take).toBe(5)
  })
})

describe('countUnread', () => {
  it('counts only rows with readAt null for the user', async () => {
    mdb.notification.count.mockResolvedValueOnce(3)
    const n = await countUnread('u1')
    expect(n).toBe(3)
    expect(mdb.notification.count).toHaveBeenCalledWith({
      where: { userId: 'u1', readAt: null },
    })
  })
})

describe('markRead', () => {
  it('updates only the listed ids, scoped to the user, and skips already-read rows', async () => {
    mdb.notification.updateMany.mockResolvedValueOnce({ count: 2 })
    await markRead('u1', { ids: ['n1', 'n2'] })
    const call = mdb.notification.updateMany.mock.calls[0][0] as any
    expect(call.where).toMatchObject({
      userId: 'u1',
      id: { in: ['n1', 'n2'] },
      readAt: null,
    })
    expect(call.data.readAt).toBeInstanceOf(Date)
  })

  it('marks all unread for the user when {all: true}', async () => {
    mdb.notification.updateMany.mockResolvedValueOnce({ count: 5 })
    await markRead('u1', { all: true })
    const call = mdb.notification.updateMany.mock.calls[0][0] as any
    expect(call.where).toMatchObject({ userId: 'u1', readAt: null })
    expect(call.where.id).toBeUndefined()
  })
})

describe('enqueueEmail', () => {
  it('writes an email job for events with a registered template', async () => {
    mdb.user.findUnique.mockResolvedValueOnce({ locale: 'en' })
    await enqueueEmail(
      { eventType: 'account_approved', recipientUserId: 'u1', payload: {} },
      mdb as any,
    )
    expect(mdb.notificationJob.create).toHaveBeenCalledTimes(1)
    expect((mdb.notificationJob.create.mock.calls[0][0] as any).data.channel).toBe('email')
  })

  it('skips events with no template (e.g. new_signup → digest-only, slice 5)', async () => {
    await enqueueEmail(
      { eventType: 'new_signup', recipientUserId: 'u1', payload: signupPayload },
      mdb as any,
    )
    expect(mdb.user.findUnique).not.toHaveBeenCalled()
    expect(mdb.notificationJob.create).not.toHaveBeenCalled()
  })

  it('skips when the recipient is gone', async () => {
    mdb.user.findUnique.mockResolvedValueOnce(null)
    await enqueueEmail(
      { eventType: 'account_approved', recipientUserId: 'missing', payload: {} },
      mdb as any,
    )
    expect(mdb.notificationJob.create).not.toHaveBeenCalled()
  })
})

describe('enqueueEmailForActiveBuddies', () => {
  it('fans out to active buddies for events with a template', async () => {
    mdb.buddyProfile.findMany.mockResolvedValueOnce([
      { user: { id: 'b1', locale: 'ja' } },
      { user: { id: 'b2', locale: 'en' } },
    ])
    await enqueueEmailForActiveBuddies(
      { eventType: 'tour_published', payload: tourPayload },
      mdb as any,
    )
    const data = (mdb.notificationJob.createMany.mock.calls[0][0] as any).data as Array<{ channel: string; recipientUserId: string }>
    expect(data).toHaveLength(2)
    expect(data.every((d) => d.channel === 'email')).toBe(true)
  })

  it('skips events with no template entirely (no DB read)', async () => {
    await enqueueEmailForActiveBuddies(
      { eventType: 'self_eval_prompt', payload: tourPayload },
      mdb as any,
    )
    expect(mdb.buddyProfile.findMany).not.toHaveBeenCalled()
  })
})

describe('enqueueEmailForBookedBuddies', () => {
  it('dedupes recipients across multiple bookings on the same tour', async () => {
    mdb.booking.findMany.mockResolvedValueOnce([
      { buddy: { user: { id: 'b1', locale: 'ja' } } },
      { buddy: { user: { id: 'b1', locale: 'ja' } } }, // duplicate: two sessions, same buddy
      { buddy: { user: { id: 'b2', locale: 'en' } } },
    ])
    await enqueueEmailForBookedBuddies(
      'tour-1',
      { eventType: 'tour_cancelled', payload: tourPayload },
      mdb as any,
    )
    const data = (mdb.notificationJob.createMany.mock.calls[0][0] as any).data as Array<{ recipientUserId: string }>
    expect(data.map((d) => d.recipientUserId).sort()).toEqual(['b1', 'b2'])
  })
})

describe('enqueueEmailForTourAdmins', () => {
  const tourId = 'tour-1'
  const args = {
    eventType: 'booking_cancelled' as const,
    payload: bookingPayload,
  }

  function assignment(userId: string, prefs: Array<{ eventType: string; emailEnabled: boolean; emailMode: string }>) {
    return { admin: { user: { id: userId, locale: 'ja', notificationPrefs: prefs } } }
  }

  it('emails admins whose pref is enabled + immediate', async () => {
    mdb.tourAdminAssignment.findMany.mockResolvedValueOnce([
      assignment('a1', [{ eventType: 'cancellation', emailEnabled: true, emailMode: 'immediate' }]),
    ])
    await enqueueEmailForTourAdmins(tourId, args, mdb as any)
    const data = (mdb.notificationJob.createMany.mock.calls[0][0] as any).data as Array<{ recipientUserId: string }>
    expect(data.map((d) => d.recipientUserId)).toEqual(['a1'])
  })

  it('skips admins who opted out (emailEnabled false)', async () => {
    mdb.tourAdminAssignment.findMany.mockResolvedValueOnce([
      assignment('a1', [{ eventType: 'cancellation', emailEnabled: false, emailMode: 'immediate' }]),
    ])
    await enqueueEmailForTourAdmins(tourId, args, mdb as any)
    expect(mdb.notificationJob.createMany).not.toHaveBeenCalled()
  })

  it('skips admins on digest mode (slice 5 will pick them up via DigestQueue)', async () => {
    mdb.tourAdminAssignment.findMany.mockResolvedValueOnce([
      assignment('a1', [{ eventType: 'cancellation', emailEnabled: true, emailMode: 'digest' }]),
    ])
    await enqueueEmailForTourAdmins(tourId, args, mdb as any)
    expect(mdb.notificationJob.createMany).not.toHaveBeenCalled()
  })

  it('treats missing pref row as email-off — Slack is the admin channel now', async () => {
    mdb.tourAdminAssignment.findMany.mockResolvedValueOnce([assignment('a1', [])])
    await enqueueEmailForTourAdmins(tourId, args, mdb as any)
    expect(mdb.notificationJob.createMany).not.toHaveBeenCalled()
  })

  it('still emails an admin who explicitly re-enables it', async () => {
    mdb.tourAdminAssignment.findMany.mockResolvedValueOnce([
      assignment('a1', [{ eventType: 'cancellation', emailEnabled: true, emailMode: 'immediate' }]),
    ])
    await enqueueEmailForTourAdmins(tourId, args, mdb as any)
    const data = (mdb.notificationJob.createMany.mock.calls[0][0] as any).data as Array<{ recipientUserId: string }>
    expect(data.map((d) => d.recipientUserId)).toEqual(['a1'])
  })

  it('enqueues one channel-wide slack job with no recipient, not one per admin', async () => {
    await enqueueSlackForAdmins({ eventType: 'new_signup', payload: signupPayload }, mdb as any)

    expect(mdb.notificationJob.create).toHaveBeenCalledTimes(1)
    expect(mdb.notificationJob.createMany).not.toHaveBeenCalled()
    const data = (mdb.notificationJob.create.mock.calls[0][0] as any).data
    expect(data).toMatchObject({
      channel: 'slack',
      eventType: 'new_signup',
      recipientUserId: null,
      locale: 'ja',
    })
  })

  it('does not consult admin rows at all — the channel has no per-admin targeting', async () => {
    await enqueueSlackForAdmins({ eventType: 'new_signup', payload: signupPayload }, mdb as any)

    expect(mdb.user.findMany).not.toHaveBeenCalled()
    expect(mdb.tourAdminAssignment.findMany).not.toHaveBeenCalled()
  })

  it('skips buddy-targeted events — they have no slack template', async () => {
    await enqueueSlackForAdmins({ eventType: 'tour_reminder', payload: reminderPayload }, mdb as any)

    expect(mdb.notificationJob.create).not.toHaveBeenCalled()
  })

  it('always emails for cant_go_post_deadline regardless of prefs (PRD §10.2)', async () => {
    mdb.tourAdminAssignment.findMany.mockResolvedValueOnce([
      assignment('a1', []), // no row → would default if it were configurable
      assignment('a2', [{ eventType: 'cancellation', emailEnabled: false, emailMode: 'immediate' }]),
    ])
    await enqueueEmailForTourAdmins(
      tourId,
      { eventType: 'cant_go_post_deadline', payload: cantGoPayload },
      mdb as any,
    )
    const data = (mdb.notificationJob.createMany.mock.calls[0][0] as any).data as Array<{ recipientUserId: string }>
    expect(data.map((d) => d.recipientUserId).sort()).toEqual(['a1', 'a2'])
  })
})
