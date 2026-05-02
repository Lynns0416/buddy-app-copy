import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockListAdminEvaluations,
  mockGetAdminEvaluation,
  mockCreateAdminEvaluation,
  mockUpdateAdminEvaluation,
  mockDeleteAdminEvaluation,
  mockGetAdminProfileEvaluation,
  mockUpsertAdminProfileEvaluation,
  mockListAdminSelfEvaluations,
} = vi.hoisted(() => ({
  mockListAdminEvaluations: vi.fn(),
  mockGetAdminEvaluation: vi.fn(),
  mockCreateAdminEvaluation: vi.fn(),
  mockUpdateAdminEvaluation: vi.fn(),
  mockDeleteAdminEvaluation: vi.fn(),
  mockGetAdminProfileEvaluation: vi.fn(),
  mockUpsertAdminProfileEvaluation: vi.fn(),
  mockListAdminSelfEvaluations: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    listAdminEvaluations: mockListAdminEvaluations,
    getAdminEvaluation: mockGetAdminEvaluation,
    createAdminEvaluation: mockCreateAdminEvaluation,
    updateAdminEvaluation: mockUpdateAdminEvaluation,
    deleteAdminEvaluation: mockDeleteAdminEvaluation,
    getAdminProfileEvaluation: mockGetAdminProfileEvaluation,
    upsertAdminProfileEvaluation: mockUpsertAdminProfileEvaluation,
    listAdminSelfEvaluations: mockListAdminSelfEvaluations,
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
  listAdminEvaluations,
  getAdminEvaluation,
  createAdminEvaluation,
  updateAdminEvaluation,
  deleteAdminEvaluation,
  getAdminProfileEvaluation,
  upsertAdminProfileEvaluation,
  listAdminSelfEvaluations,
} from './admin.evaluation'
import { ApiError } from '@/lib/api'

import type { AdminEvaluationResponse, AdminProfileEvaluationResponse, AdminSelfEvaluationResponse } from '@peace-buddy/types'

const mockEval: AdminEvaluationResponse = {
  id: 'eval-1',
  buddyId: 'buddy-1',
  buddyDisplayName: 'Test Buddy',
  tourId: 'tour-1',
  tourDate: '2026-01-15T00:00:00.000Z',
  tourGroupName: 'Test Group',
  createdBy: 'user-1',
  overallRating: 4,
  overallRatingNote: null,
  reliability: null,
  reliabilityNote: null,
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
}

const mockProfileEval: AdminProfileEvaluationResponse = {
  id: 'peval-1',
  buddyId: 'buddy-1',
  createdBy: 'user-1',
  overallRating: 3,
  overallRatingNote: null,
  reliability: null,
  reliabilityNote: null,
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
}

describe('listAdminEvaluations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok with data on success', async () => {
    mockListAdminEvaluations.mockResolvedValueOnce([mockEval])
    const result = await listAdminEvaluations({ buddyId: 'buddy-1' })
    expect(result).toEqual({ ok: true, data: [mockEval] })
    expect(mockListAdminEvaluations).toHaveBeenCalledWith({ buddyId: 'buddy-1' })
  })

  it('returns error on failure', async () => {
    mockListAdminEvaluations.mockRejectedValueOnce(new ApiError('Server error', 500))
    const result = await listAdminEvaluations({})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('unknown')
  })
})

describe('getAdminEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok with data on success', async () => {
    mockGetAdminEvaluation.mockResolvedValueOnce(mockEval)
    const result = await getAdminEvaluation('eval-1')
    expect(result).toEqual({ ok: true, data: mockEval })
  })

  it('returns ok with null on 404', async () => {
    mockGetAdminEvaluation.mockRejectedValueOnce(new ApiError('Not found', 404))
    const result = await getAdminEvaluation('missing')
    expect(result).toEqual({ ok: true, data: null })
  })

  it('returns error on non-404 failure', async () => {
    mockGetAdminEvaluation.mockRejectedValueOnce(new ApiError('Server error', 500))
    const result = await getAdminEvaluation('eval-1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('unknown')
  })
})

describe('createAdminEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok with created evaluation', async () => {
    mockCreateAdminEvaluation.mockResolvedValueOnce(mockEval)
    const result = await createAdminEvaluation({ buddyId: 'buddy-1', tourId: 'tour-1', overallRating: 4 })
    expect(result).toEqual({ ok: true, data: mockEval })
  })

  it('returns invalid_request on 400', async () => {
    mockCreateAdminEvaluation.mockRejectedValueOnce(new ApiError('Bad request', 400))
    const result = await createAdminEvaluation({ buddyId: 'buddy-1', tourId: 'tour-1' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('invalid_request')
  })

  it('returns conflict on 409', async () => {
    mockCreateAdminEvaluation.mockRejectedValueOnce(new ApiError('Conflict', 409))
    const result = await createAdminEvaluation({ buddyId: 'buddy-1', tourId: 'tour-1' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('conflict')
  })
})

describe('updateAdminEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok with updated evaluation', async () => {
    mockUpdateAdminEvaluation.mockResolvedValueOnce({ ...mockEval, overallRating: 5 })
    const result = await updateAdminEvaluation('eval-1', { overallRating: 5 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.overallRating).toBe(5)
  })

  it('returns not_found on 404', async () => {
    mockUpdateAdminEvaluation.mockRejectedValueOnce(new ApiError('Not found', 404))
    const result = await updateAdminEvaluation('missing', {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('not_found')
  })
})

describe('deleteAdminEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok on success', async () => {
    mockDeleteAdminEvaluation.mockResolvedValueOnce(undefined)
    const result = await deleteAdminEvaluation('eval-1')
    expect(result).toEqual({ ok: true, data: undefined })
  })

  it('returns not_found on 404', async () => {
    mockDeleteAdminEvaluation.mockRejectedValueOnce(new ApiError('Not found', 404))
    const result = await deleteAdminEvaluation('missing')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('not_found')
  })
})

describe('getAdminProfileEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok with data on success', async () => {
    mockGetAdminProfileEvaluation.mockResolvedValueOnce(mockProfileEval)
    const result = await getAdminProfileEvaluation('buddy-1')
    expect(result).toEqual({ ok: true, data: mockProfileEval })
  })

  it('returns ok with null on 404', async () => {
    mockGetAdminProfileEvaluation.mockRejectedValueOnce(new ApiError('Not found', 404))
    const result = await getAdminProfileEvaluation('missing')
    expect(result).toEqual({ ok: true, data: null })
  })

  it('returns error on non-404 failure', async () => {
    mockGetAdminProfileEvaluation.mockRejectedValueOnce(new ApiError('Server error', 500))
    const result = await getAdminProfileEvaluation('buddy-1')
    expect(result.ok).toBe(false)
  })
})

describe('upsertAdminProfileEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok with upserted data', async () => {
    mockUpsertAdminProfileEvaluation.mockResolvedValueOnce(mockProfileEval)
    const result = await upsertAdminProfileEvaluation('buddy-1', { overallRating: 3 })
    expect(result).toEqual({ ok: true, data: mockProfileEval })
    expect(mockUpsertAdminProfileEvaluation).toHaveBeenCalledWith('buddy-1', { overallRating: 3 })
  })

  it('returns not_found on 404', async () => {
    mockUpsertAdminProfileEvaluation.mockRejectedValueOnce(new ApiError('Not found', 404))
    const result = await upsertAdminProfileEvaluation('missing', {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('not_found')
  })
})

describe('listAdminSelfEvaluations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ok with list on success', async () => {
    const mockSelf: AdminSelfEvaluationResponse[] = []
    mockListAdminSelfEvaluations.mockResolvedValueOnce(mockSelf)
    const result = await listAdminSelfEvaluations({ buddyId: 'buddy-1' })
    expect(result).toEqual({ ok: true, data: [] })
    expect(mockListAdminSelfEvaluations).toHaveBeenCalledWith({ buddyId: 'buddy-1' })
  })

  it('returns error on failure', async () => {
    mockListAdminSelfEvaluations.mockRejectedValueOnce(new Error('Network failure'))
    const result = await listAdminSelfEvaluations({})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('network')
  })
})
