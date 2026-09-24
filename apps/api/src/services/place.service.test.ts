import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { Prisma } from '@prisma/client'
import { listPlaces, createPlace, updatePlace, getPlace, createSpot, updateSpot } from './place.service'

type MockFn = Mock<(...args: unknown[]) => unknown>

interface MockDb {
  place: { findMany: MockFn; create: MockFn; update: MockFn; findUnique: MockFn }
  spot: { create: MockFn; update: MockFn; findUnique: MockFn }
}

vi.mock('../lib/db', () => {
  const mockDb: MockDb = {
    place: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    spot: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  }
  return { db: mockDb }
})

import { db } from '../lib/db'
const mdb = db as unknown as MockDb

const mockPlaceRaw = {
  id: 'place-1',
  nameJa: '平和公園',
  nameEn: 'Peace Park',
  sortOrder: 1,
  active: true,
}

const mockSpotRaw = {
  id: 'spot-1',
  placeId: 'place-1',
  nameJa: '平和祈念像',
  nameEn: 'Peace Statue',
  sortOrder: 1,
  active: true,
}

describe('listPlaces', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns places ordered by sortOrder', async () => {
    mdb.place.findMany.mockResolvedValueOnce([mockPlaceRaw])
    const result = await listPlaces()
    expect(result).toEqual([mockPlaceRaw])
    expect(mdb.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { sortOrder: 'asc' } })
    )
  })
})

describe('createPlace', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates and returns a place', async () => {
    mdb.place.create.mockResolvedValueOnce(mockPlaceRaw)
    const result = await createPlace({ nameJa: '平和公園', nameEn: 'Peace Park', sortOrder: 1, active: true })
    expect(result.id).toBe('place-1')
  })
})

describe('updatePlace', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns updated place', async () => {
    mdb.place.update.mockResolvedValueOnce({ ...mockPlaceRaw, active: false })
    const result = await updatePlace('place-1', { active: false })
    expect(result?.active).toBe(false)
  })

  it('returns null on P2025', async () => {
    mdb.place.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: '5.0.0' }),
    )
    const result = await updatePlace('missing', { active: false })
    expect(result).toBeNull()
  })

  it('rethrows non-P2025 errors', async () => {
    mdb.place.update.mockRejectedValueOnce(new Error('db failure'))
    await expect(updatePlace('place-1', { active: false })).rejects.toThrow('db failure')
  })
})

describe('getPlace', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns place with spots', async () => {
    mdb.place.findUnique.mockResolvedValueOnce({ ...mockPlaceRaw, spots: [mockSpotRaw] })
    const result = await getPlace('place-1')
    expect(result?.spots).toHaveLength(1)
    expect(result?.spots[0].id).toBe('spot-1')
  })

  it('returns null when not found', async () => {
    mdb.place.findUnique.mockResolvedValueOnce(null)
    const result = await getPlace('missing')
    expect(result).toBeNull()
  })
})

describe('createSpot', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a spot under the place', async () => {
    mdb.place.findUnique.mockResolvedValueOnce({ id: 'place-1' })
    mdb.spot.create.mockResolvedValueOnce(mockSpotRaw)
    const result = await createSpot('place-1', { nameJa: '平和祈念像', nameEn: 'Peace Statue', sortOrder: 1, active: true })
    expect(result?.placeId).toBe('place-1')
  })

  it('returns null when the place does not exist', async () => {
    mdb.place.findUnique.mockResolvedValueOnce(null)
    const result = await createSpot('missing', { nameJa: 'x', nameEn: 'x', sortOrder: 1, active: true })
    expect(result).toBeNull()
    expect(mdb.spot.create).not.toHaveBeenCalled()
  })
})

describe('updateSpot', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates a spot owned by the place', async () => {
    mdb.spot.findUnique.mockResolvedValueOnce({ placeId: 'place-1' })
    mdb.spot.update.mockResolvedValueOnce({ ...mockSpotRaw, active: false })
    const result = await updateSpot('place-1', 'spot-1', { active: false })
    expect(result?.active).toBe(false)
  })

  it('returns null when the spot does not exist', async () => {
    mdb.spot.findUnique.mockResolvedValueOnce(null)
    const result = await updateSpot('place-1', 'missing', { active: false })
    expect(result).toBeNull()
  })

  it('returns null when the spot belongs to a different place', async () => {
    mdb.spot.findUnique.mockResolvedValueOnce({ placeId: 'other-place' })
    const result = await updateSpot('place-1', 'spot-1', { active: false })
    expect(result).toBeNull()
    expect(mdb.spot.update).not.toHaveBeenCalled()
  })
})
