import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFindMany, mockFindUnique } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
}))

vi.mock('../lib/db', () => ({
  db: {
    selfEvaluation: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
    },
  },
}))

import { listSelfEvaluations, getSelfEvaluation } from './adminSelfEvaluation.service'

const selfEvalRow = {
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
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('listSelfEvaluations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped admin response with buddyDisplayName', async () => {
    mockFindMany.mockResolvedValueOnce([
      { ...selfEvalRow, buddy: { displayName: 'Test Buddy' } },
    ] as never)
    const result = await listSelfEvaluations({})
    expect(result).toHaveLength(1)
    expect(result[0].buddyDisplayName).toBe('Test Buddy')
  })

  it('passes buddyId filter', async () => {
    mockFindMany.mockResolvedValueOnce([] as never)
    await listSelfEvaluations({ buddyId: 'buddy-1' })
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { buddyId: 'buddy-1' } }),
    )
  })

  it('passes no where clause when buddyId is omitted', async () => {
    mockFindMany.mockResolvedValueOnce([] as never)
    await listSelfEvaluations({})
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    )
  })
})

describe('getSelfEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    expect(await getSelfEvaluation('missing')).toBeNull()
  })

  it('returns admin response with buddyDisplayName', async () => {
    mockFindUnique.mockResolvedValueOnce(
      { ...selfEvalRow, buddy: { displayName: 'Test Buddy' } } as never,
    )
    const result = await getSelfEvaluation('seval-1')
    expect(result?.buddyDisplayName).toBe('Test Buddy')
  })

  it('queries by id', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    await getSelfEvaluation('seval-99')
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'seval-99' } }),
    )
  })
})
