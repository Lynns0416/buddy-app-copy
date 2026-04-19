/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getBuddyProfile, updateBuddyProfile } from './buddy.service'

vi.mock('../lib/db', () => ({
  db: {
    buddyProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { db } from '../lib/db'

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockFindUnique = vi.mocked(db.buddyProfile).findUnique
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockUpdate = vi.mocked(db.buddyProfile).update

const mockProfile = {
  id: 'profile-1',
  status: 'active',
  displayName: 'Test Buddy',
  realName: 'Real Name',
  photoUrl: null,
  bio: null,
  contactInfo: null,
  languages: ['en'],
  skills: ['sign language'],
  availability: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

describe('getBuddyProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when profile is not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null as any)
    const result = await getBuddyProfile('user-1')
    expect(result).toBeNull()
  })

  it('returns the profile when found', async () => {
    mockFindUnique.mockResolvedValueOnce(mockProfile as any)
    const result = await getBuddyProfile('user-1')
    expect(result).toEqual(mockProfile)
  })

  it('queries by userId', async () => {
    mockFindUnique.mockResolvedValueOnce(mockProfile as any)
    await getBuddyProfile('user-1')
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    )
  })

  it('does not include admin-only fields in the select', async () => {
    mockFindUnique.mockResolvedValueOnce(mockProfile as any)
    await getBuddyProfile('user-1')
    const call = mockFindUnique.mock.calls[0][0] as any
    expect(call.select.internalNotes).toBeUndefined()
    expect(call.select.tier).toBeUndefined()
  })
})

describe('updateBuddyProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when profile does not exist (P2025)', async () => {
    mockUpdate.mockRejectedValueOnce({ code: 'P2025' })
    const result = await updateBuddyProfile('user-1', { bio: 'hello' })
    expect(result).toBeNull()
  })

  it('rethrows non-P2025 errors', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('db failure'))
    await expect(updateBuddyProfile('user-1', {})).rejects.toThrow('db failure')
  })

  it('returns the updated profile on success', async () => {
    mockUpdate.mockResolvedValueOnce(mockProfile as any)
    const result = await updateBuddyProfile('user-1', { bio: 'hello' })
    expect(result).toEqual(mockProfile)
  })

  it('passes data to db.update', async () => {
    mockUpdate.mockResolvedValueOnce(mockProfile as any)
    await updateBuddyProfile('user-1', { displayName: 'New Name', skills: ['english'] })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        data: { displayName: 'New Name', skills: ['english'] },
      })
    )
  })

  it('does not include admin-only fields in the select', async () => {
    mockUpdate.mockResolvedValueOnce(mockProfile as any)
    await updateBuddyProfile('user-1', {})
    const call = mockUpdate.mock.calls[0][0] as any
    expect(call.select.internalNotes).toBeUndefined()
    expect(call.select.tier).toBeUndefined()
  })
})
