import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sortGroups, nextGroupSort, sortGroupTours, nextGroupTourSort, fetchGroups, fetchGroup, createGroup, updateGroup } from './admin.group'
import type { GroupResponse, GroupDetailResponse } from '@peace-buddy/types'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    listGroups: vi.fn(),
    getGroup: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
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

const mockListGroups = vi.mocked(apiClient.listGroups)
const mockGetGroup = vi.mocked(apiClient.getGroup)
const mockCreateGroup = vi.mocked(apiClient.createGroup)
const mockUpdateGroup = vi.mocked(apiClient.updateGroup)

// ── sortGroups ────────────────────────────────────────────────────────────────

const group = (overrides: Partial<GroupResponse>): GroupResponse => ({
  id: 'g1',
  name: 'Alpha',
  type: 'school',
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  notes: null,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
})

const alpha   = group({ id: 'g1', name: 'Alpha',   type: 'community' })
const beta    = group({ id: 'g2', name: 'Beta',    type: 'company' })
const charlie = group({ id: 'g3', name: 'Charlie', type: 'school' })

describe('sortGroups', () => {
  describe('by name', () => {
    it('sorts asc', () => {
      const result = sortGroups([charlie, alpha, beta], 'name', 'asc')
      expect(result.map((g) => g.name)).toEqual(['Alpha', 'Beta', 'Charlie'])
    })

    it('sorts desc', () => {
      const result = sortGroups([charlie, alpha, beta], 'name', 'desc')
      expect(result.map((g) => g.name)).toEqual(['Charlie', 'Beta', 'Alpha'])
    })
  })

  describe('by type', () => {
    it('sorts asc', () => {
      const result = sortGroups([charlie, alpha, beta], 'type', 'asc')
      expect(result.map((g) => g.type)).toEqual(['community', 'company', 'school'])
    })

    it('sorts desc', () => {
      const result = sortGroups([charlie, alpha, beta], 'type', 'desc')
      expect(result.map((g) => g.type)).toEqual(['school', 'company', 'community'])
    })
  })

  it('does not mutate the original array', () => {
    const original = [charlie, alpha, beta]
    sortGroups(original, 'name', 'asc')
    expect(original.map((g) => g.id)).toEqual(['g3', 'g1', 'g2'])
  })

  it('returns empty array unchanged', () => {
    expect(sortGroups([], 'name', 'asc')).toEqual([])
  })
})

// ── nextGroupSort ─────────────────────────────────────────────────────────────

describe('nextGroupSort', () => {
  it('toggles asc → desc when clicking the active field', () => {
    const result = nextGroupSort({ field: 'name', dir: 'asc' }, 'name')
    expect(result).toEqual({ field: 'name', dir: 'desc' })
  })

  it('toggles desc → asc when clicking the active field', () => {
    const result = nextGroupSort({ field: 'name', dir: 'desc' }, 'name')
    expect(result).toEqual({ field: 'name', dir: 'asc' })
  })

  it('switches field and resets dir to asc', () => {
    const result = nextGroupSort({ field: 'name', dir: 'desc' }, 'type')
    expect(result).toEqual({ field: 'type', dir: 'asc' })
  })
})

// ── sortGroupTours ────────────────────────────────────────────────────────────

const place = (nameEn: string) => ({ id: nameEn, nameJa: nameEn, nameEn })

const session = (capacity: number) => ({
  id: 's1',
  order: 1,
  label: null,
  meetingTime: '2025-06-01T09:00:00Z',
  startTime: null,
  endTime: null,
  capacity,
  minBuddies: 3,
  participantCount: 0,
  place: place('Tokyo'),
})

const tour = (overrides: Partial<GroupDetailResponse['tours'][0]>): GroupDetailResponse['tours'][0] => ({
  id: 't1',
  status: 'draft',
  tourDate: '2025-06-01',
  bookingOpen: false,
  places: [place('Tokyo')],
  participantCount: 0,
  description: null,
  sessions: [session(10)],
  createdAt: '2025-01-01T00:00:00Z',
  ...overrides,
})

const t1 = tour({ id: 't1', tourDate: '2025-06-01', status: 'draft',     places: [place('Osaka')], sessions: [session(5)]  })
const t2 = tour({ id: 't2', tourDate: '2025-07-01', status: 'published', places: [place('Tokyo')], sessions: [session(10)] })
const t3 = tour({ id: 't3', tourDate: '2025-08-01', status: 'completed', places: [place('Kyoto')], sessions: [session(15)] })

describe('sortGroupTours', () => {
  describe('by tourDate', () => {
    it('sorts asc', () => {
      const result = sortGroupTours([t3, t1, t2], 'tourDate', 'asc', 'en')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't3'])
    })

    it('sorts desc', () => {
      const result = sortGroupTours([t3, t1, t2], 'tourDate', 'desc', 'en')
      expect(result.map((t) => t.id)).toEqual(['t3', 't2', 't1'])
    })
  })

  describe('by status', () => {
    it('sorts asc', () => {
      const result = sortGroupTours([t3, t1, t2], 'status', 'asc', 'en')
      expect(result.map((t) => t.status)).toEqual(['completed', 'draft', 'published'])
    })

    it('sorts desc', () => {
      const result = sortGroupTours([t3, t1, t2], 'status', 'desc', 'en')
      expect(result.map((t) => t.status)).toEqual(['published', 'draft', 'completed'])
    })
  })

  describe('by places', () => {
    it('sorts asc', () => {
      const result = sortGroupTours([t3, t1, t2], 'places', 'asc', 'en')
      expect(result.map((t) => t.places[0].nameEn)).toEqual(['Kyoto', 'Osaka', 'Tokyo'])
    })

    it('sorts desc', () => {
      const result = sortGroupTours([t3, t1, t2], 'places', 'desc', 'en')
      expect(result.map((t) => t.places[0].nameEn)).toEqual(['Tokyo', 'Osaka', 'Kyoto'])
    })
  })

  describe('by capacity', () => {
    it('sorts asc', () => {
      const result = sortGroupTours([t3, t1, t2], 'capacity', 'asc', 'en')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't3'])
    })

    it('sorts desc', () => {
      const result = sortGroupTours([t3, t1, t2], 'capacity', 'desc', 'en')
      expect(result.map((t) => t.id)).toEqual(['t3', 't2', 't1'])
    })
  })

  it('does not mutate the original array', () => {
    const original = [t3, t1, t2]
    sortGroupTours(original, 'tourDate', 'asc', 'en')
    expect(original.map((t) => t.id)).toEqual(['t3', 't1', 't2'])
  })

  it('returns empty array unchanged', () => {
    expect(sortGroupTours([], 'tourDate', 'asc', 'en')).toEqual([])
  })
})

// ── nextGroupTourSort ─────────────────────────────────────────────────────────

describe('nextGroupTourSort', () => {
  it('toggles asc → desc when clicking the active field', () => {
    const result = nextGroupTourSort({ field: 'tourDate', dir: 'asc' }, 'tourDate')
    expect(result).toEqual({ field: 'tourDate', dir: 'desc' })
  })

  it('toggles desc → asc when clicking the active field', () => {
    const result = nextGroupTourSort({ field: 'capacity', dir: 'desc' }, 'capacity')
    expect(result).toEqual({ field: 'capacity', dir: 'asc' })
  })

  it('switches field and resets dir to asc', () => {
    const result = nextGroupTourSort({ field: 'tourDate', dir: 'desc' }, 'status')
    expect(result).toEqual({ field: 'status', dir: 'asc' })
  })
})

// ── fetchGroups ───────────────────────────────────────────────────────────────

const stubGroups: GroupResponse[] = [{ id: 'g1' } as GroupResponse]

describe('fetchGroups', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockListGroups.mockResolvedValue(stubGroups)
    const result = await fetchGroups()
    expect(result).toEqual({ ok: true, data: stubGroups })
    expect(mockListGroups).toHaveBeenCalled()
  })

  it('returns network for non-ApiError throw', async () => {
    mockListGroups.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await fetchGroups()
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

// ── fetchGroup ────────────────────────────────────────────────────────────────

const stubGroup = { id: 'g1' } as GroupDetailResponse

describe('fetchGroup', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockGetGroup.mockResolvedValue(stubGroup)
    const result = await fetchGroup('g1')
    expect(result).toEqual({ ok: true, data: stubGroup })
    expect(mockGetGroup).toHaveBeenCalledWith('g1')
  })

  it('returns not_found for 404', async () => {
    mockGetGroup.mockRejectedValue(new ApiError('not found', 404))
    const result = await fetchGroup('g1')
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })

  it('returns network for non-ApiError throw', async () => {
    mockGetGroup.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await fetchGroup('g1')
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

// ── createGroup ───────────────────────────────────────────────────────────────

const stubGroupResponse = { id: 'g1' } as GroupResponse

describe('createGroup', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockCreateGroup.mockResolvedValue(stubGroupResponse)
    const result = await createGroup({ name: 'Test', type: 'school' })
    expect(result).toEqual({ ok: true, data: stubGroupResponse })
    expect(mockCreateGroup).toHaveBeenCalledWith({ name: 'Test', type: 'school' })
  })

  it('returns network for non-ApiError throw', async () => {
    mockCreateGroup.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await createGroup({ name: 'Test', type: 'school' })
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })

  it('returns unknown for unmapped status', async () => {
    mockCreateGroup.mockRejectedValue(new ApiError('server error', 500))
    const result = await createGroup({ name: 'Test', type: 'school' })
    expect(result).toEqual({ ok: false, error: { code: 'unknown' } })
  })
})

// ── updateGroup ───────────────────────────────────────────────────────────────

describe('updateGroup', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockUpdateGroup.mockResolvedValue(stubGroupResponse)
    const result = await updateGroup('g1', { name: 'Renamed' })
    expect(result).toEqual({ ok: true, data: stubGroupResponse })
    expect(mockUpdateGroup).toHaveBeenCalledWith('g1', { name: 'Renamed' })
  })

  it('returns not_found for 404', async () => {
    mockUpdateGroup.mockRejectedValue(new ApiError('not found', 404))
    const result = await updateGroup('g1', { name: 'X' })
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })

  it('returns network for non-ApiError throw', async () => {
    mockUpdateGroup.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await updateGroup('g1', { name: 'X' })
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})
