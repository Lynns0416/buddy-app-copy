import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const {
  mockBuddyFind,
  mockBookingFind,
  mockCreate,
  mockFindMany,
  mockFindUnique,
  mockUpdate,
} = vi.hoisted(() => ({
  mockBuddyFind: vi.fn(),
  mockBookingFind: vi.fn(),
  mockCreate: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('../lib/db', () => ({
  db: {
    buddyProfile: { findUnique: mockBuddyFind },
    booking: { findUnique: mockBookingFind },
    selfEvaluation: {
      create: mockCreate,
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}))

import {
  createSelfEvaluation,
  listMySelfEvaluations,
  updateSelfEvaluation,
  listSelfEvaluations,
  getSelfEvaluation,
  EvalNotFoundError,
  EvalAlreadyExistsError,
  EvalLockedError,
  NotEligibleError,
  BuddyNotFoundError,
  SELF_EVAL_EDIT_WINDOW_DAYS,
} from './selfEvaluation.service'

const recentDate = new Date()

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
  createdAt: recentDate,
  updatedAt: recentDate,
}

describe('createSelfEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates and returns mapped response with locked field', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce({
      status: 'confirmed',
      tour: { status: 'completed' },
    } as never)
    mockCreate.mockResolvedValueOnce(selfEvalRow as never)

    const result = await createSelfEvaluation({ tourId: 'tour-1', overallRating: 3 }, 'user-1')
    expect(result.id).toBe('seval-1')
    expect(result.locked).toBe(false)
  })

  it('throws BuddyNotFoundError when no buddy profile', async () => {
    mockBuddyFind.mockResolvedValueOnce(null)
    await expect(
      createSelfEvaluation({ tourId: 'tour-1' }, 'user-1'),
    ).rejects.toBeInstanceOf(BuddyNotFoundError)
  })

  it('throws NotEligibleError when no confirmed booking', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce({
      status: 'maybe',
      tour: { status: 'completed' },
    } as never)

    await expect(
      createSelfEvaluation({ tourId: 'tour-1' }, 'user-1'),
    ).rejects.toBeInstanceOf(NotEligibleError)
  })

  it('throws NotEligibleError when tour not completed', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce({
      status: 'confirmed',
      tour: { status: 'published' },
    } as never)

    await expect(
      createSelfEvaluation({ tourId: 'tour-1' }, 'user-1'),
    ).rejects.toBeInstanceOf(NotEligibleError)
  })

  it('throws NotEligibleError when no booking at all', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce(null)

    await expect(
      createSelfEvaluation({ tourId: 'tour-1' }, 'user-1'),
    ).rejects.toBeInstanceOf(NotEligibleError)
  })

  it('throws EvalAlreadyExistsError on P2002', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce({
      status: 'confirmed',
      tour: { status: 'completed' },
    } as never)
    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: '5.0.0',
    })
    mockCreate.mockRejectedValueOnce(prismaError)

    await expect(
      createSelfEvaluation({ tourId: 'tour-1' }, 'user-1'),
    ).rejects.toBeInstanceOf(EvalAlreadyExistsError)
  })
})

describe('listMySelfEvaluations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped list', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindMany.mockResolvedValueOnce([selfEvalRow] as never)
    const result = await listMySelfEvaluations('user-1')
    expect(result).toHaveLength(1)
    expect(typeof result[0].locked).toBe('boolean')
  })

  it('throws BuddyNotFoundError when no profile', async () => {
    mockBuddyFind.mockResolvedValueOnce(null)
    await expect(listMySelfEvaluations('user-1')).rejects.toBeInstanceOf(BuddyNotFoundError)
  })
})

describe('updateSelfEvaluation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates and returns response', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindUnique.mockResolvedValueOnce({ buddyId: 'buddy-1', createdAt: recentDate } as never)
    mockUpdate.mockResolvedValueOnce({ ...selfEvalRow, overallRating: 5 } as never)

    const result = await updateSelfEvaluation('seval-1', { overallRating: 5 }, 'user-1')
    expect(result.overallRating).toBe(5)
  })

  it('throws EvalNotFoundError when eval does not exist', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindUnique.mockResolvedValueOnce(null)

    await expect(
      updateSelfEvaluation('missing', {}, 'user-1'),
    ).rejects.toBeInstanceOf(EvalNotFoundError)
  })

  it('throws EvalNotFoundError when buddyId does not match', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindUnique.mockResolvedValueOnce({ buddyId: 'buddy-other', createdAt: recentDate } as never)

    await expect(
      updateSelfEvaluation('seval-1', {}, 'user-1'),
    ).rejects.toBeInstanceOf(EvalNotFoundError)
  })

  it('throws EvalLockedError when edit window has passed', async () => {
    const oldDate = new Date(Date.now() - (SELF_EVAL_EDIT_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000)
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindUnique.mockResolvedValueOnce({ buddyId: 'buddy-1', createdAt: oldDate } as never)

    await expect(
      updateSelfEvaluation('seval-1', {}, 'user-1'),
    ).rejects.toBeInstanceOf(EvalLockedError)
  })
})

describe('listSelfEvaluations (admin)', () => {
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
})

describe('getSelfEvaluation (admin)', () => {
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
})
