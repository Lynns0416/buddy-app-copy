import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const {
  mockBuddyFind,
  mockTourFind,
  mockCreate,
  mockFindMany,
  mockFindUnique,
  mockUpdate,
  mockDelete,
} = vi.hoisted(() => ({
  mockBuddyFind: vi.fn(),
  mockTourFind: vi.fn(),
  mockCreate: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('../lib/db', () => ({
  db: {
    buddyProfile: { findUnique: mockBuddyFind },
    tour: { findUnique: mockTourFind },
    adminEvaluation: {
      create: mockCreate,
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}))

import {
  createAdminEvaluation,
  listAdminEvaluations,
  getAdminEvaluation,
  updateAdminEvaluation,
  deleteAdminEvaluation,
  EvalNotFoundError,
  EvalAlreadyExistsError,
  BuddyNotFoundError,
  TourNotFoundError,
} from './adminEvaluation.service'

const evalRow = {
  id: 'eval-1',
  buddyId: 'buddy-1',
  buddy: { displayName: 'Test Buddy' },
  tourId: 'tour-1',
  tour: { tourDate: new Date('2026-01-15'), group: { name: 'Test Group' } },
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
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

describe('createAdminEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates and returns mapped response', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockTourFind.mockResolvedValueOnce({ id: 'tour-1' } as never)
    mockCreate.mockResolvedValueOnce(evalRow as never)

    const result = await createAdminEvaluation(
      { buddyId: 'buddy-1', tourId: 'tour-1', overallRating: 4 },
      'user-1',
    )
    expect(result.id).toBe('eval-1')
    expect(result.buddyDisplayName).toBe('Test Buddy')
    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('throws BuddyNotFoundError when buddy does not exist', async () => {
    mockBuddyFind.mockResolvedValueOnce(null)
    mockTourFind.mockResolvedValueOnce({ id: 'tour-1' } as never)

    await expect(
      createAdminEvaluation({ buddyId: 'missing', tourId: 'tour-1' }, 'user-1'),
    ).rejects.toBeInstanceOf(BuddyNotFoundError)
  })

  it('throws TourNotFoundError when tour does not exist', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockTourFind.mockResolvedValueOnce(null)

    await expect(
      createAdminEvaluation({ buddyId: 'buddy-1', tourId: 'missing' }, 'user-1'),
    ).rejects.toBeInstanceOf(TourNotFoundError)
  })

  it('throws EvalAlreadyExistsError on P2002', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockTourFind.mockResolvedValueOnce({ id: 'tour-1' } as never)
    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: '5.0.0',
    })
    mockCreate.mockRejectedValueOnce(prismaError)

    await expect(
      createAdminEvaluation({ buddyId: 'buddy-1', tourId: 'tour-1' }, 'user-1'),
    ).rejects.toBeInstanceOf(EvalAlreadyExistsError)
  })
})

describe('listAdminEvaluations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped list', async () => {
    mockFindMany.mockResolvedValueOnce([evalRow] as never)
    const result = await listAdminEvaluations({})
    expect(result).toHaveLength(1)
    expect(result[0].buddyDisplayName).toBe('Test Buddy')
  })

  it('passes buddyId and tourId filters', async () => {
    mockFindMany.mockResolvedValueOnce([] as never)
    await listAdminEvaluations({ buddyId: 'b1', tourId: 't1' })
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { buddyId: 'b1', tourId: 't1' } }),
    )
  })
})

describe('getAdminEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    expect(await getAdminEvaluation('missing')).toBeNull()
  })

  it('returns mapped response', async () => {
    mockFindUnique.mockResolvedValueOnce(evalRow as never)
    const result = await getAdminEvaluation('eval-1')
    expect(result?.id).toBe('eval-1')
  })
})

describe('updateAdminEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns updated response', async () => {
    mockUpdate.mockResolvedValueOnce({ ...evalRow, overallRating: 5 } as never)
    const result = await updateAdminEvaluation('eval-1', { overallRating: 5 })
    expect(result.overallRating).toBe(5)
  })

  it('throws EvalNotFoundError on P2025', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    })
    mockUpdate.mockRejectedValueOnce(prismaError)
    await expect(updateAdminEvaluation('missing', {})).rejects.toBeInstanceOf(EvalNotFoundError)
  })
})

describe('deleteAdminEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes without error', async () => {
    mockDelete.mockResolvedValueOnce(undefined as never)
    await expect(deleteAdminEvaluation('eval-1')).resolves.toBeUndefined()
  })

  it('throws EvalNotFoundError on P2025', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    })
    mockDelete.mockRejectedValueOnce(prismaError)
    await expect(deleteAdminEvaluation('missing')).rejects.toBeInstanceOf(EvalNotFoundError)
  })
})
