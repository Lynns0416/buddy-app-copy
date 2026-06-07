import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchUpcomingTours } from './buddy.tour'
import type { TourResponse } from '@peace-buddy/types'
import { TourStatusSchema } from '@peace-buddy/types'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    listTours: vi.fn(),
  },
}))

vi.mock('../../../lib/api-error', () => {
  return {
    classifyApiError: (err: unknown) => {
      if (err instanceof Error && err.message === 'not found') return { code: 'not_found' }
      if (err instanceof Error && err.message === 'network') return { code: 'network' }
      return { code: 'unknown' }
    },
  }
})

import { apiClient } from '@/lib/api-client'

const mockListTours = vi.mocked(apiClient.listTours)

const stubTours: TourResponse[] = [
  {
    id: 't1',
    groupId: 'g1',
    group: { id: 'g1', name: 'Group A', type: 'school' },
    status: TourStatusSchema.enum.published,
    tourDate: '2025-05-01T00:00:00Z',
    bookingOpen: true,
    location: 'Location A',
    participantCount: 0,
    description: null,
    cancellationDeadline: '2025-04-20T00:00:00Z',
    maybeDeadline: null,
    notificationOffsets: [3, 1],
    sessions: [],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
]

describe('fetchUpcomingTours', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockListTours.mockResolvedValue(stubTours)
    const result = await fetchUpcomingTours('2025-04-15')
    expect(result).toEqual({ ok: true, data: stubTours })
    expect(mockListTours).toHaveBeenCalledWith('2025-04-15')
  })

  it('returns error on API failure', async () => {
    mockListTours.mockRejectedValue(new Error('network'))
    const result = await fetchUpcomingTours('2025-04-15')
    expect(result.ok).toBe(false)
  })
})
