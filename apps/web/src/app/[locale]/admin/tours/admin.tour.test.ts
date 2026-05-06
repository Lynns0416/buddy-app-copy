import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sortTours, nextTourListSort, sortBookings, nextBookingSort, fetchTours, fetchGroups, fetchTour, createTour, updateTour, transitionTour, toggleTourBooking, deleteTour, fetchTierCapacities, saveTierCapacities } from './admin.tour'
import type { AdminTourDetailResponse, AdminTourSummaryResponse, GroupResponse, TierCapacities } from '@peace-buddy/types'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    listAdminTours: vi.fn(),
    listGroups: vi.fn(),
    getAdminTour: vi.fn(),
    createAdminTour: vi.fn(),
    updateAdminTour: vi.fn(),
    transitionAdminTourStatus: vi.fn(),
    deleteAdminTour: vi.fn(),
    getAdminTourTierCapacities: vi.fn(),
    saveAdminTourTierCapacities: vi.fn(),
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

const mockListAdminTours = vi.mocked(apiClient.listAdminTours)
const mockListGroups = vi.mocked(apiClient.listGroups)
const mockGetAdminTour = vi.mocked(apiClient.getAdminTour)
const mockCreateAdminTour = vi.mocked(apiClient.createAdminTour)
const mockUpdateAdminTour = vi.mocked(apiClient.updateAdminTour)
const mockTransition = vi.mocked(apiClient.transitionAdminTourStatus)
const mockDeleteAdminTour = vi.mocked(apiClient.deleteAdminTour)
const mockGetTierCapacities = vi.mocked(apiClient.getAdminTourTierCapacities)
const mockSaveTierCapacities = vi.mocked(apiClient.saveAdminTourTierCapacities)

const stubTour = { id: 't1' } as AdminTourDetailResponse
const stubSummaryTour = { id: 't1' } as AdminTourSummaryResponse
const stubGroup = { id: 'g1' } as GroupResponse

// ── sortTours ──────────────────────────────────────────────────────────────

const tour = (overrides: Partial<AdminTourSummaryResponse> = {}): AdminTourSummaryResponse => ({
  id: 't1',
  tourDate: '2025-06-01',
  group: { id: 'g1', name: 'Alpha', type: 'school' },
  location: 'Tokyo',
  capacity: 10,
  confirmedCount: 5,
  status: 'draft',
  meetingTime: '2025-06-01T09:00:00Z',
  bookingOpen: false,
  createdAt: '2025-01-01T00:00:00Z',
  startTime: null,
  endTime: null,
  description: null,
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
} as AdminTourSummaryResponse)

const t1 = tour({ id: 't1', tourDate: '2025-06-01', group: { id: 'g1', name: 'Alpha', type: 'school' }, location: 'Osaka',  capacity: 5, confirmedCount: 2, status: 'draft' })
const t2 = tour({ id: 't2', tourDate: '2025-07-01', group: { id: 'g2', name: 'Beta', type: 'company' },  location: 'Tokyo',  capacity: 10, confirmedCount: 8, status: 'published' })
const t3 = tour({ id: 't3', tourDate: '2025-08-01', group: { id: 'g3', name: 'Gamma', type: 'community' }, location: 'Kyoto',  capacity: 15, confirmedCount: 12, status: 'completed' })

describe('sortTours', () => {
  describe('by tourDate', () => {
    it('sorts asc', () => {
      const result = sortTours([t3, t1, t2], 'tourDate', 'asc')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't3'])
    })

    it('sorts desc', () => {
      const result = sortTours([t3, t1, t2], 'tourDate', 'desc')
      expect(result.map((t) => t.id)).toEqual(['t3', 't2', 't1'])
    })
  })

  describe('by group', () => {
    it('sorts asc', () => {
      const result = sortTours([t3, t1, t2], 'group', 'asc')
      expect(result.map((t) => t.group.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
    })

    it('sorts desc', () => {
      const result = sortTours([t3, t1, t2], 'group', 'desc')
      expect(result.map((t) => t.group.name)).toEqual(['Gamma', 'Beta', 'Alpha'])
    })
  })

  describe('by location', () => {
    it('sorts asc', () => {
      const result = sortTours([t3, t1, t2], 'location', 'asc')
      expect(result.map((t) => t.location)).toEqual(['Kyoto', 'Osaka', 'Tokyo'])
    })

    it('sorts desc', () => {
      const result = sortTours([t3, t1, t2], 'location', 'desc')
      expect(result.map((t) => t.location)).toEqual(['Tokyo', 'Osaka', 'Kyoto'])
    })
  })

  describe('by capacity', () => {
    it('sorts asc', () => {
      const result = sortTours([t3, t1, t2], 'capacity', 'asc')
      expect(result.map((t) => t.capacity)).toEqual([5, 10, 15])
    })

    it('sorts desc', () => {
      const result = sortTours([t3, t1, t2], 'capacity', 'desc')
      expect(result.map((t) => t.capacity)).toEqual([15, 10, 5])
    })
  })

  describe('by confirmedCount', () => {
    it('sorts asc', () => {
      const result = sortTours([t3, t1, t2], 'confirmedCount', 'asc')
      expect(result.map((t) => t.confirmedCount)).toEqual([2, 8, 12])
    })

    it('sorts desc', () => {
      const result = sortTours([t3, t1, t2], 'confirmedCount', 'desc')
      expect(result.map((t) => t.confirmedCount)).toEqual([12, 8, 2])
    })
  })

  describe('by status', () => {
    it('sorts asc', () => {
      const result = sortTours([t3, t1, t2], 'status', 'asc')
      expect(result.map((t) => t.status)).toEqual(['completed', 'draft', 'published'])
    })

    it('sorts desc', () => {
      const result = sortTours([t3, t1, t2], 'status', 'desc')
      expect(result.map((t) => t.status)).toEqual(['published', 'draft', 'completed'])
    })
  })

  it('does not mutate the original array', () => {
    const original = [t3, t1, t2]
    sortTours(original, 'tourDate', 'asc')
    expect(original.map((t) => t.id)).toEqual(['t3', 't1', 't2'])
  })

  it('returns empty array unchanged', () => {
    expect(sortTours([], 'tourDate', 'asc')).toEqual([])
  })
})

// ── nextTourListSort ───────────────────────────────────────────────────────

describe('nextTourListSort', () => {
  it('toggles asc → desc when clicking the active field', () => {
    const result = nextTourListSort({ field: 'tourDate', dir: 'asc' }, 'tourDate')
    expect(result).toEqual({ field: 'tourDate', dir: 'desc' })
  })

  it('toggles desc → asc when clicking the active field', () => {
    const result = nextTourListSort({ field: 'capacity', dir: 'desc' }, 'capacity')
    expect(result).toEqual({ field: 'capacity', dir: 'asc' })
  })

  it('switches field and resets dir to asc', () => {
    const result = nextTourListSort({ field: 'tourDate', dir: 'desc' }, 'status')
    expect(result).toEqual({ field: 'status', dir: 'asc' })
  })
})

// ── sortBookings ───────────────────────────────────────────────────────────

const booking = (overrides: Partial<AdminTourDetailResponse['bookings'][0]>): AdminTourDetailResponse['bookings'][0] => ({
  id: 'b1',
  buddyId: 'u1',
  displayName: 'Alice',
  status: 'confirmed',
  bookedAt: '2025-01-01T00:00:00Z',
  ...overrides,
})

const alice   = booking({ id: 'b1', displayName: 'Alice',   status: 'confirmed', bookedAt: '2025-01-03T00:00:00Z' })
const bob     = booking({ id: 'b2', displayName: 'Bob',     status: 'maybe',     bookedAt: '2025-01-01T00:00:00Z' })
const charlie = booking({ id: 'b3', displayName: 'Charlie', status: 'waitlist',  bookedAt: '2025-01-02T00:00:00Z' })

describe('sortBookings', () => {
  describe('by displayName', () => {
    it('sorts asc', () => {
      const result = sortBookings([charlie, alice, bob], 'displayName', 'asc')
      expect(result.map((b) => b.displayName)).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    it('sorts desc', () => {
      const result = sortBookings([charlie, alice, bob], 'displayName', 'desc')
      expect(result.map((b) => b.displayName)).toEqual(['Charlie', 'Bob', 'Alice'])
    })
  })

  describe('by status', () => {
    it('sorts asc', () => {
      const result = sortBookings([charlie, alice, bob], 'status', 'asc')
      expect(result.map((b) => b.status)).toEqual(['confirmed', 'maybe', 'waitlist'])
    })

    it('sorts desc', () => {
      const result = sortBookings([charlie, alice, bob], 'status', 'desc')
      expect(result.map((b) => b.status)).toEqual(['waitlist', 'maybe', 'confirmed'])
    })
  })

  describe('by bookedAt', () => {
    it('sorts asc', () => {
      const result = sortBookings([charlie, alice, bob], 'bookedAt', 'asc')
      expect(result.map((b) => b.id)).toEqual(['b2', 'b3', 'b1'])
    })

    it('sorts desc', () => {
      const result = sortBookings([charlie, alice, bob], 'bookedAt', 'desc')
      expect(result.map((b) => b.id)).toEqual(['b1', 'b3', 'b2'])
    })
  })

  it('does not mutate the original array', () => {
    const original = [charlie, alice, bob]
    sortBookings(original, 'displayName', 'asc')
    expect(original.map((b) => b.id)).toEqual(['b3', 'b1', 'b2'])
  })

  it('returns empty array unchanged', () => {
    expect(sortBookings([], 'displayName', 'asc')).toEqual([])
  })
})

// ── nextBookingSort ────────────────────────────────────────────────────────

describe('nextBookingSort', () => {
  it('toggles asc → desc when clicking the active field', () => {
    const result = nextBookingSort({ field: 'displayName', dir: 'asc' }, 'displayName')
    expect(result).toEqual({ field: 'displayName', dir: 'desc' })
  })

  it('toggles desc → asc when clicking the active field', () => {
    const result = nextBookingSort({ field: 'bookedAt', dir: 'desc' }, 'bookedAt')
    expect(result).toEqual({ field: 'bookedAt', dir: 'asc' })
  })

  it('switches field and resets dir to asc when clicking a different field', () => {
    const result = nextBookingSort({ field: 'displayName', dir: 'desc' }, 'status')
    expect(result).toEqual({ field: 'status', dir: 'asc' })
  })

  it('always resets dir to asc when switching fields, regardless of current dir', () => {
    const result = nextBookingSort({ field: 'bookedAt', dir: 'asc' }, 'displayName')
    expect(result).toEqual({ field: 'displayName', dir: 'asc' })
  })
})

// ── fetchTours ─────────────────────────────────────────────────────────────

describe('fetchTours', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockListAdminTours.mockResolvedValue([stubSummaryTour])
    const result = await fetchTours()
    expect(result).toEqual({ ok: true, data: [stubSummaryTour] })
    expect(mockListAdminTours).toHaveBeenCalled()
  })

  it('returns network for non-ApiError throw', async () => {
    mockListAdminTours.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await fetchTours()
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

// ── fetchGroups ────────────────────────────────────────────────────────────

describe('fetchGroups', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockListGroups.mockResolvedValue([stubGroup])
    const result = await fetchGroups()
    expect(result).toEqual({ ok: true, data: [stubGroup] })
    expect(mockListGroups).toHaveBeenCalled()
  })

  it('returns network for non-ApiError throw', async () => {
    mockListGroups.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await fetchGroups()
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

// ── fetchTour ──────────────────────────────────────────────────────────────

describe('fetchTour', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockGetAdminTour.mockResolvedValue(stubTour)
    const result = await fetchTour('t1')
    expect(result).toEqual({ ok: true, data: stubTour })
    expect(mockGetAdminTour).toHaveBeenCalledWith('t1')
  })

  it('returns not_found for 404', async () => {
    mockGetAdminTour.mockRejectedValue(new ApiError('not found', 404))
    const result = await fetchTour('t1')
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })

  it('returns network for non-ApiError throw', async () => {
    mockGetAdminTour.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await fetchTour('t1')
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

// ── createTour ─────────────────────────────────────────────────────────────

describe('createTour', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockCreateAdminTour.mockResolvedValue(stubTour)
    const result = await createTour({ groupId: 'g1', tourDate: '2025-06-01', meetingTime: '09:00', location: 'Tokyo', capacity: 10, bookingOpen: false, cancellationDeadline: '2025-05-31', notificationOffsets: '3, 1' })
    expect(result).toEqual({ ok: true, data: stubTour })
  })

  it('returns network for non-ApiError throw', async () => {
    mockCreateAdminTour.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await createTour({ groupId: 'g1', tourDate: '2025-06-01', meetingTime: '09:00', location: 'Tokyo', capacity: 10, bookingOpen: false, cancellationDeadline: '2025-05-31', notificationOffsets: '3, 1' })
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })

  it('returns unknown for unmapped status', async () => {
    mockCreateAdminTour.mockRejectedValue(new ApiError('server error', 500))
    const result = await createTour({ groupId: 'g1', tourDate: '2025-06-01', meetingTime: '09:00', location: 'Tokyo', capacity: 10, bookingOpen: false, cancellationDeadline: '2025-05-31', notificationOffsets: '3, 1' })
    expect(result).toEqual({ ok: false, error: { code: 'unknown' } })
  })
})

// ── updateTour ─────────────────────────────────────────────────────────────

describe('updateTour', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockUpdateAdminTour.mockResolvedValue(stubTour)
    const result = await updateTour('t1', { tourDate: '2025-06-02' } as Record<string, unknown>)
    expect(result).toEqual({ ok: true, data: stubTour })
    expect(mockUpdateAdminTour).toHaveBeenCalledWith('t1', { tourDate: '2025-06-02' })
  })

  it('returns not_found for 404', async () => {
    mockUpdateAdminTour.mockRejectedValue(new ApiError('not found', 404))
    const result = await updateTour('t1', { tourDate: '2025-06-02' } as Record<string, unknown>)
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })

  it('returns network for non-ApiError throw', async () => {
    mockUpdateAdminTour.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await updateTour('t1', { tourDate: '2025-06-02' } as Record<string, unknown>)
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

// ── transitionTour ────────────────────────────────────────────────────────

describe('transitionTour', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with updated tour on success', async () => {
    mockTransition.mockResolvedValue(stubTour)
    const result = await transitionTour('t1', 'publish')
    expect(result).toEqual({ ok: true, data: stubTour })
    expect(mockTransition).toHaveBeenCalledWith('t1', 'publish')
  })

  it('returns conflict for 409', async () => {
    mockTransition.mockRejectedValue(new ApiError('conflict', 409))
    const result = await transitionTour('t1', 'cancel')
    expect(result).toEqual({ ok: false, error: { code: 'conflict' } })
  })

  it('returns not_found for 404', async () => {
    mockTransition.mockRejectedValue(new ApiError('not found', 404))
    const result = await transitionTour('t1', 'publish')
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })

  it('returns network for non-ApiError throw', async () => {
    mockTransition.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await transitionTour('t1', 'complete')
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

// ── toggleTourBooking ──────────────────────────────────────────────────────

describe('toggleTourBooking', () => {
  beforeEach(() => vi.resetAllMocks())

  it('calls updateAdminTour with bookingOpen flipped to true', async () => {
    mockUpdateAdminTour.mockResolvedValue(stubTour)
    await toggleTourBooking('t1', false)
    expect(mockUpdateAdminTour).toHaveBeenCalledWith('t1', { bookingOpen: true })
  })

  it('calls updateAdminTour with bookingOpen flipped to false', async () => {
    mockUpdateAdminTour.mockResolvedValue(stubTour)
    await toggleTourBooking('t1', true)
    expect(mockUpdateAdminTour).toHaveBeenCalledWith('t1', { bookingOpen: false })
  })

  it('returns ok with updated tour on success', async () => {
    mockUpdateAdminTour.mockResolvedValue(stubTour)
    const result = await toggleTourBooking('t1', false)
    expect(result).toEqual({ ok: true, data: stubTour })
  })

  it('returns conflict for 409', async () => {
    mockUpdateAdminTour.mockRejectedValue(new ApiError('conflict', 409))
    const result = await toggleTourBooking('t1', true)
    expect(result).toEqual({ ok: false, error: { code: 'conflict' } })
  })

  it('returns unknown for unmapped status', async () => {
    mockUpdateAdminTour.mockRejectedValue(new ApiError('server error', 500))
    const result = await toggleTourBooking('t1', false)
    expect(result).toEqual({ ok: false, error: { code: 'unknown' } })
  })
})

// ── deleteTour ─────────────────────────────────────────────────────────────

describe('deleteTour', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok on success', async () => {
    mockDeleteAdminTour.mockResolvedValue(undefined)
    const result = await deleteTour('t1')
    expect(result).toEqual({ ok: true, data: undefined })
    expect(mockDeleteAdminTour).toHaveBeenCalledWith('t1')
  })

  it('returns not_found for 404', async () => {
    mockDeleteAdminTour.mockRejectedValue(new ApiError('not found', 404))
    const result = await deleteTour('t1')
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })

  it('returns conflict for 409', async () => {
    mockDeleteAdminTour.mockRejectedValue(new ApiError('conflict', 409))
    const result = await deleteTour('t1')
    expect(result).toEqual({ ok: false, error: { code: 'conflict' } })
  })

  it('returns network for non-ApiError throw', async () => {
    mockDeleteAdminTour.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await deleteTour('t1')
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

// ── fetchTierCapacities ────────────────────────────────────────────────────

const stubCapacities: TierCapacities = { junior: 20, non_junior: 30, anyone: 50 }

describe('fetchTierCapacities', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockGetTierCapacities.mockResolvedValue(stubCapacities)
    const result = await fetchTierCapacities('t1')
    expect(result).toEqual({ ok: true, data: stubCapacities })
    expect(mockGetTierCapacities).toHaveBeenCalledWith('t1')
  })

  it('returns not_found for 404', async () => {
    mockGetTierCapacities.mockRejectedValue(new ApiError('not found', 404))
    const result = await fetchTierCapacities('t1')
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })

  it('returns network for non-ApiError throw', async () => {
    mockGetTierCapacities.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await fetchTierCapacities('t1')
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

// ── saveTierCapacities ─────────────────────────────────────────────────────

describe('saveTierCapacities', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with updated data on success', async () => {
    mockSaveTierCapacities.mockResolvedValue(stubCapacities)
    const result = await saveTierCapacities('t1', stubCapacities)
    expect(result).toEqual({ ok: true, data: stubCapacities })
    expect(mockSaveTierCapacities).toHaveBeenCalledWith('t1', stubCapacities)
  })

  it('returns not_found for 404', async () => {
    mockSaveTierCapacities.mockRejectedValue(new ApiError('not found', 404))
    const result = await saveTierCapacities('t1', stubCapacities)
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })

  it('returns network for non-ApiError throw', async () => {
    mockSaveTierCapacities.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await saveTierCapacities('t1', stubCapacities)
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})
