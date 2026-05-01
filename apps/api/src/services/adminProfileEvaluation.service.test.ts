import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockBuddyFind, mockUpsert, mockFindUnique } = vi.hoisted(() => ({
  mockBuddyFind: vi.fn(),
  mockUpsert: vi.fn(),
  mockFindUnique: vi.fn(),
}))

vi.mock('../lib/db', () => ({
  db: {
    buddyProfile: { findUnique: mockBuddyFind },
    adminProfileEvaluation: {
      upsert: mockUpsert,
      findUnique: mockFindUnique,
    },
  },
}))

import {
  upsertProfileEvaluation,
  getProfileEvaluation,
  BuddyNotFoundError,
} from './adminProfileEvaluation.service'

const profileRow = {
  id: 'peval-1',
  buddyId: 'buddy-1',
  createdBy: 'user-1',
  overallRating: 4,
  overallRatingNote: null,
  reliability: null,
  reliabilityNote: null,
  communication: 3,
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
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

describe('upsertProfileEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts and returns mapped response', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockUpsert.mockResolvedValueOnce(profileRow as never)

    const result = await upsertProfileEvaluation('buddy-1', { overallRating: 4, communication: 3 }, 'user-1')
    expect(result.id).toBe('peval-1')
    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('throws BuddyNotFoundError when buddy does not exist', async () => {
    mockBuddyFind.mockResolvedValueOnce(null)
    await expect(
      upsertProfileEvaluation('missing', {}, 'user-1'),
    ).rejects.toBeInstanceOf(BuddyNotFoundError)
  })

  it('uses partial update semantics — omitted fields not in update clause', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockUpsert.mockResolvedValueOnce(profileRow as never)

    await upsertProfileEvaluation('buddy-1', { communication: 3 }, 'user-1')

    const upsertCall = mockUpsert.mock.calls[0][0] as { update: Record<string, unknown> }
    expect(upsertCall.update).toEqual({ communication: 3 })
    expect(upsertCall.update).not.toHaveProperty('overallRating')
    expect(upsertCall.update).not.toHaveProperty('reliability')
  })
})

describe('getProfileEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    expect(await getProfileEvaluation('missing')).toBeNull()
  })

  it('returns mapped response', async () => {
    mockFindUnique.mockResolvedValueOnce(profileRow as never)
    const result = await getProfileEvaluation('buddy-1')
    expect(result?.buddyId).toBe('buddy-1')
  })
})
