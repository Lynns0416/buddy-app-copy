/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listBuddies, updateBuddyStatus, getBuddyDetail, updateBuddyProfile } from './admin.service'

vi.mock('../lib/db', () => ({
  db: {
    buddyProfile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { db } from '../lib/db'

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockFindMany = vi.mocked(db.buddyProfile).findMany
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockFindUnique = vi.mocked(db.buddyProfile).findUnique
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockUpdate = vi.mocked(db.buddyProfile).update

const mockRaw = {
  id: 'profile-1',
  userId: 'user-1',
  status: 'pending',
  tier: null,
  displayName: 'Test Buddy',
  realName: 'Real Name',
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
      status: 'confirmed',
      bookedAt: new Date('2026-03-01'),
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
  displayName: 'Test Buddy',
  realName: 'Real Name',
  internalNotes: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  email: 'buddy@example.com',
}

describe('listBuddies', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped buddies', async () => {
    mockFindMany.mockResolvedValueOnce([mockRaw] as any)
    const result = await listBuddies()
    expect(result).toEqual([mockMapped])
  })

  it('filters by status when provided', async () => {
    mockFindMany.mockResolvedValueOnce([mockRaw] as any)
    await listBuddies('pending')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'pending' } })
    )
  })

  it('passes no where clause when status is omitted', async () => {
    mockFindMany.mockResolvedValueOnce([] as any)
    await listBuddies()
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined })
    )
  })

  it('flattens user.email into response', async () => {
    mockFindMany.mockResolvedValueOnce([mockRaw] as any)
    const result = await listBuddies()
    expect(result[0].email).toBe('buddy@example.com')
    expect((result[0] as Record<string, unknown>).user).toBeUndefined()
  })
})

describe('getBuddyDetail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped buddy with bookings when found', async () => {
    mockFindUnique.mockResolvedValueOnce(mockRawWithBookings as any)
    const result = await getBuddyDetail('profile-1')
    expect(result).not.toBeNull()
    expect(result!.email).toBe('buddy@example.com')
    expect(result!.bookings).toHaveLength(1)
    expect(result!.bookings[0].id).toBe('booking-1')
    expect(result!.bookings[0].bookedAt).toBe(new Date('2026-03-01').toISOString())
    expect(result!.bookings[0].tour.tourDate).toBe(new Date('2026-05-01').toISOString())
    expect(result!.bookings[0].tour.group.name).toBe('Group A')
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'profile-1' } })
    )
  })

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    const result = await getBuddyDetail('missing')
    expect(result).toBeNull()
  })
})

describe('updateBuddyProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates tier and internalNotes', async () => {
    const updated = { ...mockRaw, tier: 'junior', internalNotes: 'good notes' }
    mockUpdate.mockResolvedValueOnce(updated as any)
    const result = await updateBuddyProfile('profile-1', 'junior', 'good notes')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'profile-1' }, data: { tier: 'junior', internalNotes: 'good notes' } })
    )
    expect(result?.email).toBe('buddy@example.com')
  })

  it('updates only tier when internalNotes is undefined', async () => {
    mockUpdate.mockResolvedValueOnce({ ...mockRaw, tier: 'senior' } as any)
    await updateBuddyProfile('profile-1', 'senior', undefined)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tier: 'senior' } })
    )
  })

  it('falls back to findUnique when no fields provided', async () => {
    mockFindUnique.mockResolvedValueOnce(mockRaw as any)
    const result = await updateBuddyProfile('profile-1', undefined, undefined)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockFindUnique).toHaveBeenCalled()
    expect(result).toEqual(mockMapped)
  })

  it('returns null on P2025', async () => {
    mockUpdate.mockRejectedValueOnce({ code: 'P2025' })
    const result = await updateBuddyProfile('profile-1', 'junior', null)
    expect(result).toBeNull()
  })

  it('rethrows non-P2025 errors', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('db failure'))
    await expect(updateBuddyProfile('profile-1', 'junior', null)).rejects.toThrow('db failure')
  })
})

describe('updateBuddyStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null on P2025', async () => {
    mockUpdate.mockRejectedValueOnce({ code: 'P2025' })
    const result = await updateBuddyStatus('profile-1', 'active')
    expect(result).toBeNull()
  })

  it('rethrows non-P2025 errors', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('db failure'))
    await expect(updateBuddyStatus('profile-1', 'rejected')).rejects.toThrow('db failure')
  })

  it('defaults tier to trainee when approving without tier', async () => {
    mockUpdate.mockResolvedValueOnce({ ...mockRaw, status: 'active', tier: 'trainee' } as any)
    await updateBuddyStatus('profile-1', 'active')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'active', tier: 'trainee' } })
    )
  })

  it('uses provided tier when approving', async () => {
    mockUpdate.mockResolvedValueOnce({ ...mockRaw, status: 'active', tier: 'junior' } as any)
    await updateBuddyStatus('profile-1', 'active', 'junior')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'active', tier: 'junior' } })
    )
  })

  it('does not set tier when rejecting', async () => {
    mockUpdate.mockResolvedValueOnce({ ...mockRaw, status: 'rejected' } as any)
    await updateBuddyStatus('profile-1', 'rejected')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'rejected' } })
    )
  })

  it('returns mapped buddy on success', async () => {
    const raw = { ...mockRaw, status: 'active', tier: 'trainee' }
    mockUpdate.mockResolvedValueOnce(raw as any)
    const result = await updateBuddyStatus('profile-1', 'active')
    expect(result?.email).toBe('buddy@example.com')
    expect((result as Record<string, unknown> | null)?.user).toBeUndefined()
  })
})
