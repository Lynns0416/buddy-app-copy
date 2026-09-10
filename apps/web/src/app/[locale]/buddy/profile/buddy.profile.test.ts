import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchMyProfile, updateMyProfile } from './buddy.profile'
import type { BuddyProfileResponse } from '@peace-buddy/types'
import { BuddyStatusSchema } from '@peace-buddy/types'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getMyProfile: vi.fn(),
    updateMyProfile: vi.fn(),
  },
}))

vi.mock('../../../../lib/api-error', () => ({
  classifyApiError: (err: unknown) => {
    if (err instanceof Error && err.message === 'not found') return { code: 'not_found' }
    if (err instanceof Error && err.message === 'network') return { code: 'network' }
    return { code: 'unknown' }
  },
}))

import { apiClient } from '@/lib/api-client'

const mockGetMyProfile = vi.mocked(apiClient.getMyProfile)
const mockUpdateMyProfile = vi.mocked(apiClient.updateMyProfile)

const stubProfile: BuddyProfileResponse = {
  id: 'p1',
  status: BuddyStatusSchema.enum.active,
  displayName: 'Test Buddy',
  realName: 'Real Name',
  photoUrl: null,
  bio: null,
  contactInfo: null,
  languages: ['english', 'japanese'],
  skills: ['sign language'],
  onboardingSeenAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('fetchMyProfile', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockGetMyProfile.mockResolvedValue(stubProfile)
    const result = await fetchMyProfile()
    expect(result).toEqual({ ok: true, data: stubProfile })
  })

  it('returns error on API failure', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('network'))
    const result = await fetchMyProfile()
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

describe('updateMyProfile', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with updated data on success', async () => {
    const updated = { ...stubProfile, displayName: 'New Name' }
    mockUpdateMyProfile.mockResolvedValue(updated)
    const result = await updateMyProfile({ displayName: 'New Name' })
    expect(result).toEqual({ ok: true, data: updated })
    expect(mockUpdateMyProfile).toHaveBeenCalledWith({ displayName: 'New Name' })
  })

  it('returns error on API failure', async () => {
    mockUpdateMyProfile.mockRejectedValue(new Error('unknown'))
    const result = await updateMyProfile({ displayName: 'New Name' })
    expect(result).toEqual({ ok: false, error: { code: 'unknown' } })
  })
})
