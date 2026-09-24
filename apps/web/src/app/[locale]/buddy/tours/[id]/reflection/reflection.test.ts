import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockListMyReflections,
  mockCreateReflection,
  mockUpdateReflection,
} = vi.hoisted(() => ({
  mockListMyReflections: vi.fn(),
  mockCreateReflection: vi.fn(),
  mockUpdateReflection: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    listMyReflections: mockListMyReflections,
    createReflection: mockCreateReflection,
    updateReflection: mockUpdateReflection,
  },
}))

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }
  return { ApiError }
})

import { listMyReflections, createReflection, updateReflection } from './reflection'
import { ApiError } from '@/lib/api'
import type { TourReflectionResponse } from '@peace-buddy/types'

const mockReflection: TourReflectionResponse = {
  id: 'refl-1',
  buddyId: 'buddy-1',
  sessionId: 'session-1',
  sessionOrder: 1,
  sessionLabel: null,
  tourId: 'tour-1',
  didWell: 'Kept everyone together',
  couldImprove: null,
  notesForOthers: null,
  openQuestions: null,
  moments: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  locked: false,
}

const oneFilled = { didWell: 'Kept everyone together', moments: [] as never[] }

describe('listMyReflections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok with data on success', async () => {
    mockListMyReflections.mockResolvedValueOnce([mockReflection])
    const result = await listMyReflections({ tourId: 'tour-1' })
    expect(result).toEqual({ ok: true, data: [mockReflection] })
    expect(mockListMyReflections).toHaveBeenCalledWith({ tourId: 'tour-1' })
  })

  it('passes empty params by default', async () => {
    mockListMyReflections.mockResolvedValueOnce([])
    const result = await listMyReflections()
    expect(result).toEqual({ ok: true, data: [] })
    expect(mockListMyReflections).toHaveBeenCalledWith({})
  })

  it('returns unknown error on ApiError 500', async () => {
    mockListMyReflections.mockRejectedValueOnce(new ApiError('Server error', 500))
    const result = await listMyReflections()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('unknown')
  })

  it('returns network error on non-ApiError', async () => {
    mockListMyReflections.mockRejectedValueOnce(new Error('Network failure'))
    const result = await listMyReflections()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('network')
  })
})

describe('createReflection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok with the created reflection', async () => {
    mockCreateReflection.mockResolvedValueOnce(mockReflection)
    const result = await createReflection({ sessionId: 'session-1', ...oneFilled })
    expect(result).toEqual({ ok: true, data: mockReflection })
    expect(mockCreateReflection).toHaveBeenCalledWith({ sessionId: 'session-1', ...oneFilled })
  })

  it('returns forbidden on 403', async () => {
    mockCreateReflection.mockRejectedValueOnce(new ApiError('Forbidden', 403))
    const result = await createReflection({ sessionId: 'session-1', ...oneFilled })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('forbidden')
  })

  it('returns conflict on 409', async () => {
    mockCreateReflection.mockRejectedValueOnce(new ApiError('Conflict', 409))
    const result = await createReflection({ sessionId: 'session-1', ...oneFilled })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('conflict')
  })

  it('returns network error on non-ApiError', async () => {
    mockCreateReflection.mockRejectedValueOnce(new Error('Network failure'))
    const result = await createReflection({ sessionId: 'session-1', ...oneFilled })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('network')
  })
})

describe('updateReflection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok with the updated reflection', async () => {
    mockUpdateReflection.mockResolvedValueOnce({ ...mockReflection, didWell: 'Kept calm' })
    const result = await updateReflection('refl-1', { didWell: 'Kept calm', moments: [] })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.didWell).toBe('Kept calm')
    expect(mockUpdateReflection).toHaveBeenCalledWith('refl-1', { didWell: 'Kept calm', moments: [] })
  })

  it('returns not_found on 404', async () => {
    mockUpdateReflection.mockRejectedValueOnce(new ApiError('Not found', 404))
    const result = await updateReflection('missing', oneFilled)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('not_found')
  })

  it('returns conflict on 409 (edit window closed)', async () => {
    mockUpdateReflection.mockRejectedValueOnce(new ApiError('Locked', 409))
    const result = await updateReflection('refl-1', oneFilled)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('conflict')
  })

  it('returns network error on non-ApiError', async () => {
    mockUpdateReflection.mockRejectedValueOnce(new Error('Network failure'))
    const result = await updateReflection('refl-1', oneFilled)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('network')
  })
})
