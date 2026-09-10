import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMyProfile } from './use-my-profile'
import type { BuddyProfileResponse } from '@peace-buddy/types'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getMyProfile: vi.fn(),
  },
}))

import { apiClient } from '@/lib/api-client'

const mockGetMyProfile = vi.mocked(apiClient.getMyProfile)

const stubProfile: BuddyProfileResponse = {
  id: 'p1',
  status: 'active',
  displayName: 'Test Buddy',
  realName: 'Real Name',
  photoUrl: null,
  bio: null,
  contactInfo: null,
  languages: ['english'],
  skills: [],
  onboardingSeenAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('useMyProfile', () => {
  beforeEach(() => vi.resetAllMocks())

  it('does not fetch when not enabled', () => {
    renderHook(() => useMyProfile(false))
    expect(mockGetMyProfile).not.toHaveBeenCalled()
  })

  it('fetches and returns profile when enabled', async () => {
    mockGetMyProfile.mockResolvedValue(stubProfile)
    const { result } = renderHook(() => useMyProfile(true))
    await waitFor(() => expect(result.current.profile).toEqual(stubProfile))
    expect(result.current.error).toBe(false)
  })

  it('sets error on fetch failure', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useMyProfile(true))
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.profile).toBeNull()
  })

  it('refetch updates profile', async () => {
    mockGetMyProfile.mockResolvedValue(stubProfile)
    const { result } = renderHook(() => useMyProfile(true))
    await waitFor(() => expect(result.current.profile).toEqual(stubProfile))

    const updated = { ...stubProfile, displayName: 'Updated' }
    mockGetMyProfile.mockResolvedValue(updated)
    await result.current.refetch()
    await waitFor(() => expect(result.current.profile).toEqual(updated))
  })
})
