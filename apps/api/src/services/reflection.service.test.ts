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
    booking: { findFirst: mockBookingFind },
    tourReflection: {
      create: mockCreate,
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}))

import {
  createReflection,
  listMyReflections,
  updateReflection,
  ReflectionNotFoundError,
  ReflectionAlreadyExistsError,
  ReflectionLockedError,
  NotEligibleError,
  BuddyNotFoundError,
  REFLECTION_EDIT_WINDOW_DAYS,
} from './reflection.service'

// Typed wrapper: expect.objectContaining returns `any` in this Vitest version
function oc<T extends Record<string, unknown>>(v: T): T {
  return expect.objectContaining(v) as unknown as T
}

const recentDate = new Date()

const reflectionRow = {
  id: 'refl-1',
  buddyId: 'buddy-1',
  sessionId: 'session-1',
  didWell: 'Kept everyone together',
  couldImprove: null,
  memorableMoment: null,
  notesForOthers: null,
  openQuestions: null,
  createdAt: recentDate,
  updatedAt: recentDate,
  session: { tourId: 'tour-1', order: 1, label: null },
}

const oneFilled = { didWell: 'Kept everyone together' }

describe('createReflection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates and returns the tour and session read through the relation', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce({ session: { tour: { status: 'completed' } } } as never)
    mockCreate.mockResolvedValueOnce(reflectionRow as never)

    const result = await createReflection({ sessionId: 'session-1', ...oneFilled }, 'user-1')
    expect(result.id).toBe('refl-1')
    expect(result.tourId).toBe('tour-1')
    expect(result.sessionOrder).toBe(1)
    expect(result.locked).toBe(false)
  })

  it('stores a blank prompt as null and trims the rest', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce({ session: { tour: { status: 'completed' } } } as never)
    mockCreate.mockResolvedValueOnce(reflectionRow as never)

    await createReflection(
      { sessionId: 'session-1', didWell: '  kept calm  ', couldImprove: '   ' },
      'user-1',
    )
    expect(mockCreate).toHaveBeenCalledWith(
      oc({
        data: oc({
          didWell: 'kept calm',
          couldImprove: null,
          memorableMoment: null,
          notesForOthers: null,
          openQuestions: null,
        }),
      }),
    )
  })

  it('throws BuddyNotFoundError when no buddy profile', async () => {
    mockBuddyFind.mockResolvedValueOnce(null)
    await expect(
      createReflection({ sessionId: 'session-1', ...oneFilled }, 'user-1'),
    ).rejects.toBeInstanceOf(BuddyNotFoundError)
  })

  it('throws NotEligibleError when there is no confirmed booking on the session', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce(null)

    await expect(
      createReflection({ sessionId: 'session-1', ...oneFilled }, 'user-1'),
    ).rejects.toBeInstanceOf(NotEligibleError)
  })

  it('looks the booking up by session, not by tour', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce({ session: { tour: { status: 'completed' } } } as never)
    mockCreate.mockResolvedValueOnce(reflectionRow as never)

    await createReflection({ sessionId: 'session-1', ...oneFilled }, 'user-1')
    expect(mockBookingFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { buddyId: 'buddy-1', sessionId: 'session-1', status: 'confirmed' },
      }),
    )
  })

  it('throws NotEligibleError when the tour is not completed', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce({ session: { tour: { status: 'published' } } } as never)

    await expect(
      createReflection({ sessionId: 'session-1', ...oneFilled }, 'user-1'),
    ).rejects.toBeInstanceOf(NotEligibleError)
  })

  it('throws ReflectionAlreadyExistsError on P2002', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce({ session: { tour: { status: 'completed' } } } as never)
    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: '5.0.0',
    })
    mockCreate.mockRejectedValueOnce(prismaError)

    await expect(
      createReflection({ sessionId: 'session-1', ...oneFilled }, 'user-1'),
    ).rejects.toBeInstanceOf(ReflectionAlreadyExistsError)
  })
})

describe('listMyReflections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped list', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindMany.mockResolvedValueOnce([reflectionRow] as never)
    const result = await listMyReflections('user-1')
    expect(result).toHaveLength(1)
    expect(result[0].tourId).toBe('tour-1')
    expect(typeof result[0].locked).toBe('boolean')
  })

  it('filters by tour through the session relation', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindMany.mockResolvedValueOnce([] as never)
    await listMyReflections('user-1', { tourId: 'tour-1' })
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { buddyId: 'buddy-1', session: { tourId: 'tour-1' } },
      }),
    )
  })

  it('omits the tour filter when not provided', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindMany.mockResolvedValueOnce([] as never)
    await listMyReflections('user-1')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { buddyId: 'buddy-1' } }),
    )
  })

  it('throws BuddyNotFoundError when no profile', async () => {
    mockBuddyFind.mockResolvedValueOnce(null)
    await expect(listMyReflections('user-1')).rejects.toBeInstanceOf(BuddyNotFoundError)
  })
})

describe('updateReflection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('replaces all five prompts, clearing the ones left out', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindUnique.mockResolvedValueOnce({ buddyId: 'buddy-1', createdAt: recentDate } as never)
    mockUpdate.mockResolvedValueOnce({ ...reflectionRow, didWell: 'Kept calm' } as never)

    const result = await updateReflection('refl-1', { didWell: 'Kept calm' }, 'user-1')
    expect(result.didWell).toBe('Kept calm')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          didWell: 'Kept calm',
          couldImprove: null,
          memorableMoment: null,
          notesForOthers: null,
          openQuestions: null,
        },
      }),
    )
  })

  it('throws ReflectionNotFoundError when the row does not exist', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindUnique.mockResolvedValueOnce(null)

    await expect(
      updateReflection('missing', oneFilled, 'user-1'),
    ).rejects.toBeInstanceOf(ReflectionNotFoundError)
  })

  it('throws ReflectionNotFoundError when the row belongs to another buddy', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindUnique.mockResolvedValueOnce({ buddyId: 'buddy-other', createdAt: recentDate } as never)

    await expect(
      updateReflection('refl-1', oneFilled, 'user-1'),
    ).rejects.toBeInstanceOf(ReflectionNotFoundError)
  })

  it('throws ReflectionLockedError when the edit window has passed', async () => {
    const oldDate = new Date(Date.now() - (REFLECTION_EDIT_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000)
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindUnique.mockResolvedValueOnce({ buddyId: 'buddy-1', createdAt: oldDate } as never)

    await expect(
      updateReflection('refl-1', oneFilled, 'user-1'),
    ).rejects.toBeInstanceOf(ReflectionLockedError)
  })
})
