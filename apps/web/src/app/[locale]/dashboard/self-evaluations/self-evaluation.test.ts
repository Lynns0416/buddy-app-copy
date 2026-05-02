import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockListMySelfEvaluations,
  mockCreateSelfEvaluation,
  mockUpdateSelfEvaluation,
} = vi.hoisted(() => ({
  mockListMySelfEvaluations: vi.fn(),
  mockCreateSelfEvaluation: vi.fn(),
  mockUpdateSelfEvaluation: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    listMySelfEvaluations: mockListMySelfEvaluations,
    createSelfEvaluation: mockCreateSelfEvaluation,
    updateSelfEvaluation: mockUpdateSelfEvaluation,
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

import {
  listMySelfEvaluations,
  createSelfEvaluation,
  updateSelfEvaluation,
} from './self-evaluation'
import { ApiError } from '@/lib/api'
import type { SelfEvaluationResponse } from '@peace-buddy/types'

const mockSelfEval: SelfEvaluationResponse = {
  id: 'seval-1',
  buddyId: 'buddy-1',
  tourId: 'tour-1',
  overallRating: 3,
  overallRatingNote: null,
  communication: null,
  communicationNote: null,
  groupEngagement: null,
  groupEngagementNote: null,
  memory: null,
  memoryNote: null,
  knowledge: null,
  knowledgeNote: null,
  dedication: null,
  dedicationNote: null,
  dialogue: null,
  dialogueNote: null,
  adaptability: null,
  adaptabilityNote: null,
  emotionNote: null,
  confidence: null,
  confidenceNote: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  locked: false,
}

describe('listMySelfEvaluations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok with data on success', async () => {
    mockListMySelfEvaluations.mockResolvedValueOnce([mockSelfEval])
    const result = await listMySelfEvaluations({ tourId: 'tour-1' })
    expect(result).toEqual({ ok: true, data: [mockSelfEval] })
    expect(mockListMySelfEvaluations).toHaveBeenCalledWith({ tourId: 'tour-1' })
  })

  it('passes empty params by default', async () => {
    mockListMySelfEvaluations.mockResolvedValueOnce([])
    const result = await listMySelfEvaluations()
    expect(result).toEqual({ ok: true, data: [] })
    expect(mockListMySelfEvaluations).toHaveBeenCalledWith({})
  })

  it('returns unknown error on ApiError 500', async () => {
    mockListMySelfEvaluations.mockRejectedValueOnce(new ApiError('Server error', 500))
    const result = await listMySelfEvaluations()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('unknown')
  })

  it('returns network error on non-ApiError', async () => {
    mockListMySelfEvaluations.mockRejectedValueOnce(new Error('Network failure'))
    const result = await listMySelfEvaluations()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('network')
  })
})

describe('createSelfEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok with created evaluation', async () => {
    mockCreateSelfEvaluation.mockResolvedValueOnce(mockSelfEval)
    const result = await createSelfEvaluation({ tourId: 'tour-1', overallRating: 3 })
    expect(result).toEqual({ ok: true, data: mockSelfEval })
    expect(mockCreateSelfEvaluation).toHaveBeenCalledWith({ tourId: 'tour-1', overallRating: 3 })
  })

  it('returns forbidden on 403', async () => {
    mockCreateSelfEvaluation.mockRejectedValueOnce(new ApiError('Forbidden', 403))
    const result = await createSelfEvaluation({ tourId: 'tour-1' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('forbidden')
  })

  it('returns conflict on 409', async () => {
    mockCreateSelfEvaluation.mockRejectedValueOnce(new ApiError('Conflict', 409))
    const result = await createSelfEvaluation({ tourId: 'tour-1' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('conflict')
  })

  it('returns network error on non-ApiError', async () => {
    mockCreateSelfEvaluation.mockRejectedValueOnce(new Error('Network failure'))
    const result = await createSelfEvaluation({ tourId: 'tour-1' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('network')
  })
})

describe('updateSelfEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok with updated evaluation', async () => {
    mockUpdateSelfEvaluation.mockResolvedValueOnce({ ...mockSelfEval, overallRating: 5 })
    const result = await updateSelfEvaluation('seval-1', { overallRating: 5 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.overallRating).toBe(5)
    expect(mockUpdateSelfEvaluation).toHaveBeenCalledWith('seval-1', { overallRating: 5 })
  })

  it('returns not_found on 404', async () => {
    mockUpdateSelfEvaluation.mockRejectedValueOnce(new ApiError('Not found', 404))
    const result = await updateSelfEvaluation('missing', {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('not_found')
  })

  it('returns conflict on 409 (edit window closed)', async () => {
    mockUpdateSelfEvaluation.mockRejectedValueOnce(new ApiError('Locked', 409))
    const result = await updateSelfEvaluation('seval-1', {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('conflict')
  })

  it('returns network error on non-ApiError', async () => {
    mockUpdateSelfEvaluation.mockRejectedValueOnce(new Error('Network failure'))
    const result = await updateSelfEvaluation('seval-1', {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('network')
  })
})
