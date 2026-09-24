import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const {
  mockBuddyFind,
  mockBookingFind,
  mockCreate,
  mockFindMany,
  mockFindUnique,
  mockFindUniqueOrThrow,
  mockUpdate,
  mockMomentDeleteMany,
  mockMomentCreateMany,
  mockTransaction,
  mockSpotCount,
} = vi.hoisted(() => ({
  mockBuddyFind: vi.fn(),
  mockBookingFind: vi.fn(),
  mockCreate: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFindUniqueOrThrow: vi.fn(),
  mockUpdate: vi.fn(),
  mockMomentDeleteMany: vi.fn(),
  mockMomentCreateMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockSpotCount: vi.fn(),
}))

vi.mock('../lib/db', () => ({
  db: {
    buddyProfile: { findUnique: mockBuddyFind },
    booking: { findFirst: mockBookingFind },
    tourReflection: {
      create: mockCreate,
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      findUniqueOrThrow: mockFindUniqueOrThrow,
      update: mockUpdate,
    },
    tourReflectionMoment: {
      deleteMany: mockMomentDeleteMany,
      createMany: mockMomentCreateMany,
    },
    spot: { count: mockSpotCount },
    $transaction: mockTransaction,
  },
}))

// updateReflection's transaction only ever touches tourReflection.update and
// tourReflectionMoment.deleteMany/createMany, so the tx object can reuse the
// same mocks the plain db object exposes.
mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) =>
  fn({
    tourReflection: { update: mockUpdate },
    tourReflectionMoment: { deleteMany: mockMomentDeleteMany, createMany: mockMomentCreateMany },
  }),
)

import {
  createReflection,
  listMyReflections,
  updateReflection,
  ReflectionNotFoundError,
  ReflectionAlreadyExistsError,
  ReflectionLockedError,
  NotEligibleError,
  BuddyNotFoundError,
  InvalidSpotError,
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
  notesForOthers: null,
  openQuestions: null,
  moments: [],
  createdAt: recentDate,
  updatedAt: recentDate,
  session: { tourId: 'tour-1', order: 1, label: null },
}

const oneFilled = { didWell: 'Kept everyone together', moments: [] as never[] }

const completedBooking = { session: { placeId: 'place-1', tour: { status: 'completed' } } }
const editableRow = { buddyId: 'buddy-1', createdAt: recentDate, session: { placeId: 'place-1' } }

describe('createReflection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates and returns the tour and session read through the relation', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce(completedBooking as never)
    mockCreate.mockResolvedValueOnce(reflectionRow as never)

    const result = await createReflection({ sessionId: 'session-1', ...oneFilled }, 'user-1')
    expect(result.id).toBe('refl-1')
    expect(result.tourId).toBe('tour-1')
    expect(result.sessionOrder).toBe(1)
    expect(result.locked).toBe(false)
  })

  it('stores a blank prompt as null and trims the rest', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce(completedBooking as never)
    mockCreate.mockResolvedValueOnce(reflectionRow as never)

    await createReflection(
      { sessionId: 'session-1', didWell: '  kept calm  ', couldImprove: '   ', moments: [] },
      'user-1',
    )
    expect(mockCreate).toHaveBeenCalledWith(
      oc({
        data: oc({
          didWell: 'kept calm',
          couldImprove: null,
          notesForOthers: null,
          openQuestions: null,
          moments: { create: [] },
        }),
      }),
    )
  })

  it('creates moments in entry order with position derived from array index', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce(completedBooking as never)
    mockSpotCount.mockResolvedValueOnce(1)
    mockCreate.mockResolvedValueOnce(reflectionRow as never)

    await createReflection(
      {
        sessionId: 'session-1',
        moments: [
          { spotId: 'spot-1', description: 'Saw the statue' },
          { placeNote: 'Somewhere else', description: 'A quiet moment' },
        ],
      },
      'user-1',
    )

    expect(mockCreate).toHaveBeenCalledWith(
      oc({
        data: oc({
          moments: {
            create: [
              { position: 0, spotId: 'spot-1', placeNote: null, description: 'Saw the statue' },
              { position: 1, spotId: null, placeNote: 'Somewhere else', description: 'A quiet moment' },
            ],
          },
        }),
      }),
    )
  })

  it('checks each distinct spot against the session\'s place', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce(completedBooking as never)
    mockSpotCount.mockResolvedValueOnce(1)
    mockCreate.mockResolvedValueOnce(reflectionRow as never)

    await createReflection(
      {
        sessionId: 'session-1',
        moments: [
          { spotId: 'spot-1', description: 'A' },
          { spotId: 'spot-1', description: 'B' },
        ],
      },
      'user-1',
    )
    expect(mockSpotCount).toHaveBeenCalledWith({
      where: { id: { in: ['spot-1'] }, placeId: 'place-1' },
    })
  })

  it('throws InvalidSpotError when a spot is not at the session\'s place', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce(completedBooking as never)
    mockSpotCount.mockResolvedValueOnce(0)

    await expect(
      createReflection(
        { sessionId: 'session-1', moments: [{ spotId: 'spot-elsewhere', description: 'A' }] },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(InvalidSpotError)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('stores a blank placeNote as null, never beside a spotId', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce(completedBooking as never)
    mockSpotCount.mockResolvedValueOnce(1)
    mockCreate.mockResolvedValueOnce(reflectionRow as never)

    await createReflection(
      { sessionId: 'session-1', moments: [{ spotId: 'spot-1', placeNote: '', description: 'A' }] },
      'user-1',
    )
    expect(mockCreate).toHaveBeenCalledWith(
      oc({
        data: oc({
          moments: { create: [{ position: 0, spotId: 'spot-1', placeNote: null, description: 'A' }] },
        }),
      }),
    )
  })

  it('skips the spot check when no moment names a spot', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockBookingFind.mockResolvedValueOnce(completedBooking as never)
    mockCreate.mockResolvedValueOnce(reflectionRow as never)

    await createReflection(
      { sessionId: 'session-1', moments: [{ placeNote: 'Somewhere else', description: 'A' }] },
      'user-1',
    )
    expect(mockSpotCount).not.toHaveBeenCalled()
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
    mockBookingFind.mockResolvedValueOnce(completedBooking as never)
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
    mockBookingFind.mockResolvedValueOnce(completedBooking as never)
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

  it('replaces the four prompts, clearing the ones left out', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindUnique.mockResolvedValueOnce(editableRow as never)
    mockFindUniqueOrThrow.mockResolvedValueOnce({ ...reflectionRow, didWell: 'Kept calm' } as never)

    const result = await updateReflection('refl-1', { didWell: 'Kept calm', moments: [] }, 'user-1')
    expect(result.didWell).toBe('Kept calm')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          didWell: 'Kept calm',
          couldImprove: null,
          notesForOthers: null,
          openQuestions: null,
        },
      }),
    )
  })

  it('deletes and recreates every moment rather than diffing', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindUnique.mockResolvedValueOnce(editableRow as never)
    mockSpotCount.mockResolvedValueOnce(1)
    mockFindUniqueOrThrow.mockResolvedValueOnce(reflectionRow as never)

    await updateReflection(
      'refl-1',
      {
        moments: [
          { spotId: 'spot-1', description: 'A' },
          { placeNote: 'Other', description: 'B' },
        ],
      },
      'user-1',
    )

    expect(mockMomentDeleteMany).toHaveBeenCalledWith({ where: { reflectionId: 'refl-1' } })
    expect(mockMomentCreateMany).toHaveBeenCalledWith({
      data: [
        { reflectionId: 'refl-1', position: 0, spotId: 'spot-1', placeNote: null, description: 'A' },
        { reflectionId: 'refl-1', position: 1, spotId: null, placeNote: 'Other', description: 'B' },
      ],
    })
  })

  it('skips createMany when every moment was removed', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindUnique.mockResolvedValueOnce(editableRow as never)
    mockFindUniqueOrThrow.mockResolvedValueOnce(reflectionRow as never)

    await updateReflection('refl-1', { didWell: 'Kept calm', moments: [] }, 'user-1')

    expect(mockMomentDeleteMany).toHaveBeenCalledWith({ where: { reflectionId: 'refl-1' } })
    expect(mockMomentCreateMany).not.toHaveBeenCalled()
  })

  it('throws InvalidSpotError before writing when a spot is not on the tour', async () => {
    mockBuddyFind.mockResolvedValueOnce({ id: 'buddy-1' } as never)
    mockFindUnique.mockResolvedValueOnce(editableRow as never)
    mockSpotCount.mockResolvedValueOnce(0)

    await expect(
      updateReflection('refl-1', { moments: [{ spotId: 'spot-elsewhere', description: 'A' }] }, 'user-1'),
    ).rejects.toBeInstanceOf(InvalidSpotError)
    expect(mockTransaction).not.toHaveBeenCalled()
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
