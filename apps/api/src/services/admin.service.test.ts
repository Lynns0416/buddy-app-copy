import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listBuddies, updateBuddyStatus } from './admin.service'

vi.mock('../lib/db', () => ({
  db: {
    buddyProfile: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { db } from '../lib/db'

const mockFindMany = vi.mocked(db.buddyProfile.findMany)
const mockUpdate = vi.mocked(db.buddyProfile.update)

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
    expect((result[0] as any).user).toBeUndefined()
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
    expect((result as any)?.user).toBeUndefined()
  })
})
