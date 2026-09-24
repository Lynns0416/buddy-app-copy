import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFindMany, mockFindUnique } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
}))

vi.mock('../lib/db', () => ({
  db: {
    tourReflection: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
    },
  },
}))

import { listReflections, getReflection } from './adminReflection.service'

const reflectionRow = {
  id: 'refl-1',
  buddyId: 'buddy-1',
  sessionId: 'session-1',
  didWell: 'Kept everyone together',
  couldImprove: null,
  notesForOthers: null,
  openQuestions: null,
  moments: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  buddy: { displayName: 'Test Buddy' },
  session: {
    tourId: 'tour-1',
    order: 2,
    label: 'Afternoon',
    tour: { tourDate: new Date('2026-09-10T00:00:00.000Z') },
  },
}

describe('listReflections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the buddy name and the tour read through the session', async () => {
    mockFindMany.mockResolvedValueOnce([reflectionRow] as never)
    const result = await listReflections({})
    expect(result).toHaveLength(1)
    expect(result[0].buddyDisplayName).toBe('Test Buddy')
    expect(result[0].tourId).toBe('tour-1')
    expect(result[0].sessionOrder).toBe(2)
    expect(result[0].sessionLabel).toBe('Afternoon')
    expect(result[0].tourDate).toBe('2026-09-10T00:00:00.000Z')
  })

  it('passes buddyId filter', async () => {
    mockFindMany.mockResolvedValueOnce([] as never)
    await listReflections({ buddyId: 'buddy-1' })
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { buddyId: 'buddy-1' } }),
    )
  })

  it('passes no where clause when buddyId is omitted', async () => {
    mockFindMany.mockResolvedValueOnce([] as never)
    await listReflections({})
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    )
  })
})

describe('getReflection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    expect(await getReflection('missing')).toBeNull()
  })

  it('returns the mapped admin response', async () => {
    mockFindUnique.mockResolvedValueOnce(reflectionRow as never)
    const result = await getReflection('refl-1')
    expect(result?.buddyDisplayName).toBe('Test Buddy')
    expect(result?.didWell).toBe('Kept everyone together')
  })

  it('queries by id', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    await getReflection('refl-99')
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'refl-99' } }),
    )
  })
})
