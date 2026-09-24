import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sortPlaces, nextPlaceSort, fetchPlaces, fetchPlace, createPlace, updatePlace, createSpot, updateSpot } from './admin.place'
import type { PlaceResponse, PlaceDetailResponse, SpotResponse } from '@peace-buddy/types'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    listPlaces: vi.fn(),
    getPlace: vi.fn(),
    createPlace: vi.fn(),
    updatePlace: vi.fn(),
    createSpot: vi.fn(),
    updateSpot: vi.fn(),
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

import { apiClient } from '@/lib/api-client'
import { ApiError } from '@/lib/api'

const mockListPlaces = vi.mocked(apiClient.listPlaces)
const mockGetPlace = vi.mocked(apiClient.getPlace)
const mockCreatePlace = vi.mocked(apiClient.createPlace)
const mockUpdatePlace = vi.mocked(apiClient.updatePlace)
const mockCreateSpot = vi.mocked(apiClient.createSpot)
const mockUpdateSpot = vi.mocked(apiClient.updateSpot)

const place = (overrides: Partial<PlaceResponse>): PlaceResponse => ({
  id: 'p1',
  nameJa: 'アルファ',
  nameEn: 'Alpha',
  sortOrder: 1,
  active: true,
  ...overrides,
})

const alpha   = place({ id: 'p1', nameJa: 'アルファ', nameEn: 'Alpha',   sortOrder: 3, active: true })
const beta    = place({ id: 'p2', nameJa: 'ベータ',   nameEn: 'Beta',    sortOrder: 1, active: false })
const charlie = place({ id: 'p3', nameJa: 'チャーリー', nameEn: 'Charlie', sortOrder: 2, active: true })

describe('sortPlaces', () => {
  describe('by nameEn', () => {
    it('sorts asc', () => {
      const result = sortPlaces([charlie, alpha, beta], 'nameEn', 'asc')
      expect(result.map((p) => p.nameEn)).toEqual(['Alpha', 'Beta', 'Charlie'])
    })

    it('sorts desc', () => {
      const result = sortPlaces([charlie, alpha, beta], 'nameEn', 'desc')
      expect(result.map((p) => p.nameEn)).toEqual(['Charlie', 'Beta', 'Alpha'])
    })
  })

  describe('by sortOrder', () => {
    it('sorts asc', () => {
      const result = sortPlaces([charlie, alpha, beta], 'sortOrder', 'asc')
      expect(result.map((p) => p.id)).toEqual(['p2', 'p3', 'p1'])
    })
  })

  describe('by active', () => {
    it('sorts asc (inactive first, ties keeping input order)', () => {
      const result = sortPlaces([charlie, alpha, beta], 'active', 'asc')
      expect(result.map((p) => p.id)).toEqual(['p2', 'p3', 'p1'])
    })
  })

  it('does not mutate the original array', () => {
    const original = [charlie, alpha, beta]
    sortPlaces(original, 'nameEn', 'asc')
    expect(original.map((p) => p.id)).toEqual(['p3', 'p1', 'p2'])
  })

  it('returns empty array unchanged', () => {
    expect(sortPlaces([], 'nameEn', 'asc')).toEqual([])
  })
})

describe('nextPlaceSort', () => {
  it('toggles asc → desc when clicking the active field', () => {
    const result = nextPlaceSort({ field: 'nameEn', dir: 'asc' }, 'nameEn')
    expect(result).toEqual({ field: 'nameEn', dir: 'desc' })
  })

  it('switches field and resets dir to asc', () => {
    const result = nextPlaceSort({ field: 'nameEn', dir: 'desc' }, 'sortOrder')
    expect(result).toEqual({ field: 'sortOrder', dir: 'asc' })
  })
})

describe('fetchPlaces', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockListPlaces.mockResolvedValue([alpha])
    const result = await fetchPlaces()
    expect(result).toEqual({ ok: true, data: [alpha] })
  })

  it('returns network for non-ApiError throw', async () => {
    mockListPlaces.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await fetchPlaces()
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

describe('fetchPlace', () => {
  beforeEach(() => vi.resetAllMocks())

  const detail = { ...alpha, spots: [] } as PlaceDetailResponse

  it('returns ok with data on success', async () => {
    mockGetPlace.mockResolvedValue(detail)
    const result = await fetchPlace('p1')
    expect(result).toEqual({ ok: true, data: detail })
    expect(mockGetPlace).toHaveBeenCalledWith('p1')
  })

  it('returns not_found for 404', async () => {
    mockGetPlace.mockRejectedValue(new ApiError('not found', 404))
    const result = await fetchPlace('p1')
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })
})

describe('createPlace', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockCreatePlace.mockResolvedValue(alpha)
    const result = await createPlace({ nameJa: 'アルファ', nameEn: 'Alpha', sortOrder: 1, active: true })
    expect(result).toEqual({ ok: true, data: alpha })
  })
})

describe('updatePlace', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockUpdatePlace.mockResolvedValue({ ...alpha, active: false })
    const result = await updatePlace('p1', { active: false })
    expect(result).toEqual({ ok: true, data: { ...alpha, active: false } })
  })
})

describe('createSpot', () => {
  beforeEach(() => vi.resetAllMocks())

  const spot: SpotResponse = { id: 's1', placeId: 'p1', nameJa: 'スポット', nameEn: 'Spot', sortOrder: 1, active: true }

  it('returns ok with data on success', async () => {
    mockCreateSpot.mockResolvedValue(spot)
    const result = await createSpot('p1', { nameJa: 'スポット', nameEn: 'Spot', sortOrder: 1, active: true })
    expect(result).toEqual({ ok: true, data: spot })
    expect(mockCreateSpot).toHaveBeenCalledWith('p1', { nameJa: 'スポット', nameEn: 'Spot', sortOrder: 1, active: true })
  })

  it('returns not_found when the place does not exist', async () => {
    mockCreateSpot.mockRejectedValue(new ApiError('not found', 404))
    const result = await createSpot('missing', { nameJa: 'x', nameEn: 'x', sortOrder: 1, active: true })
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })
})

describe('updateSpot', () => {
  beforeEach(() => vi.resetAllMocks())

  const spot: SpotResponse = { id: 's1', placeId: 'p1', nameJa: 'スポット', nameEn: 'Spot', sortOrder: 1, active: false }

  it('returns ok with data on success', async () => {
    mockUpdateSpot.mockResolvedValue(spot)
    const result = await updateSpot('p1', 's1', { active: false })
    expect(result).toEqual({ ok: true, data: spot })
    expect(mockUpdateSpot).toHaveBeenCalledWith('p1', 's1', { active: false })
  })
})
