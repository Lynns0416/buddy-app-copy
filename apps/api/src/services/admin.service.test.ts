import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { listBuddies, updateBuddyStatus, getBuddyDetail, updateBuddyProfile, updateCancellationReason, updateAdminBookingStatus } from './admin.service'

type MockFn = Mock<(...args: unknown[]) => unknown>
interface MockDb {
  buddyProfile: { findMany: MockFn; findUnique: MockFn; update: MockFn }
  cancellationReason: { update: MockFn }
  adminEvaluation: { count: MockFn }
  booking: { update: MockFn }
  user: { findUnique: MockFn }
  notificationJob: { create: MockFn }
  $transaction: MockFn
}

vi.mock('../lib/db', () => {
  const $transaction = vi.fn()
  const mockDb = {
    buddyProfile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    cancellationReason: {
      update: vi.fn(),
    },
    adminEvaluation: {
      count: vi.fn(),
    },
    booking: {
      update: vi.fn(),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ locale: 'ja' }) },
    notificationJob: { create: vi.fn() },
    $transaction,
  }
  $transaction.mockImplementation((fn: unknown) => {
    if (typeof fn === 'function') return (fn as (tx: unknown) => Promise<unknown>)(mockDb)
    return Promise.all(fn as Promise<unknown>[])
  })
  return { db: mockDb }
})

import { db } from '../lib/db'
const mdb = db as unknown as MockDb

const mockRaw = {
  id: 'profile-1',
  userId: 'user-1',
  status: 'pending',
  tier: null,
  memberType: 'buddy',
  displayName: 'Test Buddy',
  realName: 'Real Name',
  photoKey: null,
  internalNotes: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  user: { email: 'buddy@example.com' },
}

const mockRawWithBookings = {
  ...mockRaw,
  bookings: [
    {
      id: 'booking-1',
      tourId: 'tour-1',
      sessionId: 'session-1',
      session: { order: 1, label: null },
      status: 'confirmed',
      bookedAt: new Date('2026-03-01'),
      cancellationReason: null,
      tour: {
        tourDate: new Date('2026-05-01'),
        location: 'Main Hall',
        status: 'published',
        group: { name: 'Group A' },
      },
    },
  ],
}

const mockMapped = {
  id: 'profile-1',
  userId: 'user-1',
  status: 'pending',
  tier: null,
  memberType: 'buddy',
  displayName: 'Test Buddy',
  realName: 'Real Name',
  photoUrl: null,
  internalNotes: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  email: 'buddy@example.com',
}

describe('listBuddies', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped buddies', async () => {
    mdb.buddyProfile.findMany.mockResolvedValueOnce([mockRaw] as unknown[])
    const result = await listBuddies()
    expect(result).toEqual([mockMapped])
  })

  it('filters by status when provided', async () => {
    mdb.buddyProfile.findMany.mockResolvedValueOnce([mockRaw] as unknown[])
    await listBuddies('pending')
    expect(mdb.buddyProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'pending' } })
    )
  })

  it('filters by memberType when provided', async () => {
    mdb.buddyProfile.findMany.mockResolvedValueOnce([mockRaw] as unknown[])
    await listBuddies(undefined, undefined, 'plab_member')
    expect(mdb.buddyProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { memberType: 'plab_member' } })
    )
  })

  it('combines status, tier and memberType filters', async () => {
    mdb.buddyProfile.findMany.mockResolvedValueOnce([] as unknown[])
    await listBuddies('active', 'blackstar', 'plab_member')
    expect(mdb.buddyProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'active', tier: 'blackstar', memberType: 'plab_member' } })
    )
  })

  it('passes no where clause when status is omitted', async () => {
    mdb.buddyProfile.findMany.mockResolvedValueOnce([] as unknown[])
    await listBuddies()
    expect(mdb.buddyProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined })
    )
  })

  it('flattens user.email into response', async () => {
    mdb.buddyProfile.findMany.mockResolvedValueOnce([mockRaw] as unknown[])
    const result = await listBuddies()
    expect(result[0].email).toBe('buddy@example.com')
    expect((result[0] as Record<string, unknown>).user).toBeUndefined()
  })
})

describe('getBuddyDetail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped buddy with bookings when found', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockRawWithBookings as unknown)
    mdb.adminEvaluation.count.mockResolvedValueOnce(0)
    const result = await getBuddyDetail('profile-1')
    expect(result).not.toBeNull()
    expect(result!.email).toBe('buddy@example.com')
    expect(result!.bookings).toHaveLength(1)
    expect(result!.bookings[0].id).toBe('booking-1')
    expect(result!.bookings[0].bookedAt).toBe(new Date('2026-03-01').toISOString())
    expect(result!.bookings[0].tour.tourDate).toBe(new Date('2026-05-01').toISOString())
    expect(result!.bookings[0].tour.group.name).toBe('Group A')
    expect(result!.absenceSummary).toEqual({ absentWithoutReport: 0 })
    expect(mdb.buddyProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'profile-1' } })
    )
  })

  it('returns null when not found', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(null)
    mdb.adminEvaluation.count.mockResolvedValueOnce(0)
    const result = await getBuddyDetail('missing')
    expect(result).toBeNull()
  })

  it('returns cancellationSummary with zero counts when no bookings have reasons', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockRawWithBookings as unknown)
    mdb.adminEvaluation.count.mockResolvedValueOnce(0)
    const result = await getBuddyDetail('profile-1')
    expect(result!.cancellationSummary).toEqual({ total: 0, unavoidable: 0, avoidable: 0, unreviewed: 0 })
  })

  it('computes cancellationSummary correctly across mixed unavoidable values', async () => {
    const rawWithReasons = {
      ...mockRaw,
      bookings: [
        {
          id: 'b-1', tourId: 'tour-1', sessionId: 's-1',
          session: { order: 1, label: null }, status: 'declined',
          bookedAt: new Date('2026-03-01'),
          cancellationReason: { id: 'cr-1', category: 'health', freeText: null, unavoidable: true, createdAt: new Date(), recorder: { email: 'a@a.com' } },
          tour: { tourDate: new Date('2026-05-01'), location: 'Hall', status: 'completed', group: { name: 'G' } },
        },
        {
          id: 'b-2', tourId: 'tour-2', sessionId: 's-2',
          session: { order: 1, label: null }, status: 'declined',
          bookedAt: new Date('2026-04-01'),
          cancellationReason: { id: 'cr-2', category: 'personal', freeText: null, unavoidable: false, createdAt: new Date(), recorder: { email: 'a@a.com' } },
          tour: { tourDate: new Date('2026-06-01'), location: 'Hall', status: 'completed', group: { name: 'G' } },
        },
        {
          id: 'b-3', tourId: 'tour-3', sessionId: 's-3',
          session: { order: 1, label: null }, status: 'declined',
          bookedAt: new Date('2026-04-15'),
          cancellationReason: { id: 'cr-3', category: 'work', freeText: null, unavoidable: null, createdAt: new Date(), recorder: { email: 'a@a.com' } },
          tour: { tourDate: new Date('2026-07-01'), location: 'Hall', status: 'completed', group: { name: 'G' } },
        },
      ],
    }
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(rawWithReasons as unknown)
    mdb.adminEvaluation.count.mockResolvedValueOnce(2)
    const result = await getBuddyDetail('profile-1')
    expect(result!.cancellationSummary).toEqual({ total: 3, unavoidable: 1, avoidable: 1, unreviewed: 1 })
    expect(result!.absenceSummary).toEqual({ absentWithoutReport: 2 })
  })
})

describe('updateCancellationReason', () => {
  beforeEach(() => vi.clearAllMocks())

  const mockCrRaw = {
    id: 'cr-1',
    category: 'health',
    freeText: null,
    unavoidable: true,
    createdAt: new Date('2026-03-01'),
    recorder: { email: 'admin@example.com' },
  }

  it('returns updated reason on success', async () => {
    mdb.cancellationReason.update.mockResolvedValueOnce(mockCrRaw as unknown)
    const result = await updateCancellationReason('booking-1', true)
    expect(mdb.cancellationReason.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bookingId: 'booking-1' }, data: { unavoidable: true } })
    )
    expect(result).not.toBeNull()
    expect(result!.unavoidable).toBe(true)
    expect(result!.recordedBy.email).toBe('admin@example.com')
  })

  it('accepts null for unavoidable', async () => {
    mdb.cancellationReason.update.mockResolvedValueOnce({ ...mockCrRaw, unavoidable: null } as unknown)
    const result = await updateCancellationReason('booking-1', null)
    expect(mdb.cancellationReason.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { unavoidable: null } })
    )
    expect(result!.unavoidable).toBeNull()
  })

  it('returns null on P2025 (booking has no cancellation reason)', async () => {
    mdb.cancellationReason.update.mockRejectedValueOnce({ code: 'P2025' })
    const result = await updateCancellationReason('booking-1', false)
    expect(result).toBeNull()
  })

  it('rethrows non-P2025 errors', async () => {
    mdb.cancellationReason.update.mockRejectedValueOnce(new Error('db failure'))
    await expect(updateCancellationReason('booking-1', true)).rejects.toThrow('db failure')
  })
})

describe('updateBuddyProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates tier and internalNotes', async () => {
    const updated = { ...mockRaw, tier: 'junior', internalNotes: 'good notes' }
    mdb.buddyProfile.update.mockResolvedValueOnce(updated as unknown)
    const result = await updateBuddyProfile('profile-1', 'junior', 'good notes')
    expect(mdb.buddyProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'profile-1' }, data: { tier: 'junior', internalNotes: 'good notes' } })
    )
    expect(result?.email).toBe('buddy@example.com')
  })

  it('updates memberType', async () => {
    mdb.buddyProfile.update.mockResolvedValueOnce({ ...mockRaw, memberType: 'plab_member' } as unknown)
    await updateBuddyProfile('profile-1', undefined, undefined, 'plab_member')
    expect(mdb.buddyProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { memberType: 'plab_member' } })
    )
  })

  it('updates only tier when internalNotes is undefined', async () => {
    mdb.buddyProfile.update.mockResolvedValueOnce({ ...mockRaw, tier: 'star' } as unknown)
    await updateBuddyProfile('profile-1', 'star', undefined)
    expect(mdb.buddyProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tier: 'star' } })
    )
  })

  it('falls back to findUnique when no fields provided', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce(mockRaw as unknown)
    const result = await updateBuddyProfile('profile-1', undefined, undefined)
    expect(mdb.buddyProfile.update).not.toHaveBeenCalled()
    expect(mdb.buddyProfile.findUnique).toHaveBeenCalled()
    expect(result).toEqual(mockMapped)
  })

  it('returns null on P2025', async () => {
    mdb.buddyProfile.update.mockRejectedValueOnce({ code: 'P2025' })
    const result = await updateBuddyProfile('profile-1', 'junior', null)
    expect(result).toBeNull()
  })

  it('rethrows non-P2025 errors', async () => {
    mdb.buddyProfile.update.mockRejectedValueOnce(new Error('db failure'))
    await expect(updateBuddyProfile('profile-1', 'junior', null)).rejects.toThrow('db failure')
  })
})

describe('updateAdminBookingStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns updated booking on success', async () => {
    mdb.booking.update.mockResolvedValueOnce({ id: 'booking-1', status: 'waitlist' } as unknown)
    const result = await updateAdminBookingStatus('booking-1', 'waitlist')
    expect(mdb.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'booking-1' }, data: { status: 'waitlist' } })
    )
    expect(result).toEqual({ id: 'booking-1', status: 'waitlist' })
  })

  it('returns null on P2025 (booking not found)', async () => {
    mdb.booking.update.mockRejectedValueOnce({ code: 'P2025' })
    const result = await updateAdminBookingStatus('booking-1', 'confirmed')
    expect(result).toBeNull()
  })

  it('rethrows non-P2025 errors', async () => {
    mdb.booking.update.mockRejectedValueOnce(new Error('db failure'))
    await expect(updateAdminBookingStatus('booking-1', 'confirmed')).rejects.toThrow('db failure')
  })
})

describe('updateBuddyStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mdb.buddyProfile.findUnique.mockResolvedValue({ status: 'pending', userId: 'user-1' })
    mdb.user.findUnique.mockResolvedValue({ locale: 'ja' })
  })

  it('returns null on P2025', async () => {
    mdb.buddyProfile.update.mockRejectedValueOnce({ code: 'P2025' })
    const result = await updateBuddyStatus('profile-1', 'active')
    expect(result).toBeNull()
  })

  it('rethrows non-P2025 errors', async () => {
    mdb.buddyProfile.update.mockRejectedValueOnce(new Error('db failure'))
    await expect(updateBuddyStatus('profile-1', 'rejected')).rejects.toThrow('db failure')
  })

  it('sets no tier when approving to trainee', async () => {
    mdb.buddyProfile.update.mockResolvedValueOnce({ ...mockRaw, status: 'trainee', tier: null } as unknown)
    await updateBuddyStatus('profile-1', 'trainee')
    expect(mdb.buddyProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'trainee' } })
    )
  })

  it('sets tier to junior when promoting to active', async () => {
    mdb.buddyProfile.update.mockResolvedValueOnce({ ...mockRaw, status: 'active', tier: 'junior' } as unknown)
    await updateBuddyStatus('profile-1', 'active')
    expect(mdb.buddyProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'active', tier: 'junior' } })
    )
  })

  it('does not set tier when rejecting', async () => {
    mdb.buddyProfile.update.mockResolvedValueOnce({ ...mockRaw, status: 'rejected' } as unknown)
    await updateBuddyStatus('profile-1', 'rejected')
    expect(mdb.buddyProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'rejected' } })
    )
  })

  it('returns mapped buddy on success', async () => {
    const raw = { ...mockRaw, status: 'active', tier: 'junior' }
    mdb.buddyProfile.update.mockResolvedValueOnce(raw as unknown)
    const result = await updateBuddyStatus('profile-1', 'active')
    expect(result?.email).toBe('buddy@example.com')
    expect((result as Record<string, unknown> | null)?.user).toBeUndefined()
  })

  it('enqueues account_approved (in-app + email) when transitioning pending → trainee', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce({ status: 'pending', userId: 'user-1' })
    mdb.buddyProfile.update.mockResolvedValueOnce({ ...mockRaw, status: 'trainee' } as unknown)
    await updateBuddyStatus('profile-1', 'trainee')

    // One in-app job and one email job; both for account_approved → user-1.
    expect(mdb.notificationJob.create).toHaveBeenCalledTimes(2)
    const calls = mdb.notificationJob.create.mock.calls.map((c) => (c[0] as { data: { channel: string; eventType: string; recipientUserId: string } }).data)
    expect(calls.map((d) => d.channel).sort()).toEqual(['email', 'in_app'])
    for (const d of calls) {
      expect(d.eventType).toBe('account_approved')
      expect(d.recipientUserId).toBe('user-1')
    }
  })

  it('enqueues account_rejected (in-app + email) when transitioning pending → rejected', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce({ status: 'pending', userId: 'user-1' })
    mdb.buddyProfile.update.mockResolvedValueOnce({ ...mockRaw, status: 'rejected' } as unknown)
    await updateBuddyStatus('profile-1', 'rejected')

    expect(mdb.notificationJob.create).toHaveBeenCalledTimes(2)
    const eventTypes = mdb.notificationJob.create.mock.calls.map((c) => (c[0] as { data: { eventType: string } }).data.eventType)
    expect(new Set(eventTypes)).toEqual(new Set(['account_rejected']))
  })

  it('does not enqueue when status was not pending (e.g. trainee → active)', async () => {
    mdb.buddyProfile.findUnique.mockResolvedValueOnce({ status: 'trainee', userId: 'user-1' })
    mdb.buddyProfile.update.mockResolvedValueOnce({ ...mockRaw, status: 'active' } as unknown)
    await updateBuddyStatus('profile-1', 'active')

    expect(mdb.notificationJob.create).not.toHaveBeenCalled()
  })
})
