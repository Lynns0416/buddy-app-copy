import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sortTours, nextTourListSort, monthGrid, shiftMonth, toursByDate, tourViewFromParams, tourMonthFromParams, tourPageToParams, sortBookings, nextBookingSort, fetchTours, fetchGroups, fetchTour, createTour, updateTour, transitionTour, toggleTourBooking, deleteTour, downloadTourCalendar, fetchSessionTierCapacities, saveSessionTierCapacities, filterTours, isTourFilterActive, emptyTourFilters, tourFiltersFromParams, tourFiltersToParams, groupIdFromParams, type TourFilters } from './admin.tour'
import type { AdminTourDetailResponse, AdminTourSummaryResponse, GroupResponse, TierCapacities, TourSessionResponse } from '@peace-buddy/types'
import { adminTourSummary } from '@/test/tour-fixtures'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    listAdminTours: vi.fn(),
    listGroups: vi.fn(),
    getAdminTour: vi.fn(),
    createAdminTour: vi.fn(),
    updateAdminTour: vi.fn(),
    transitionAdminTourStatus: vi.fn(),
    deleteAdminTour: vi.fn(),
    downloadAdminTourCalendar: vi.fn(),
    getSessionTierCapacities: vi.fn(),
    saveSessionTierCapacities: vi.fn(),
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
const mockDownloadAdminTourCalendar = vi.mocked(apiClient.downloadAdminTourCalendar)
const mockGetTierCapacities = vi.mocked(apiClient.getSessionTierCapacities)
const mockSaveTierCapacities = vi.mocked(apiClient.saveSessionTierCapacities)

const stubTour = { id: 't1' } as AdminTourDetailResponse
const stubSummaryTour = { id: 't1' } as AdminTourSummaryResponse
const stubGroup = { id: 'g1' } as GroupResponse

// ── sortTours ──────────────────────────────────────────────────────────────

const tour = adminTourSummary

const place = (name: string) => [{ id: name, nameJa: name, nameEn: name }]

const t1 = tour({ id: 't1', tourDate: '2025-06-01', group: { id: 'g1', name: 'Alpha', type: 'school' }, places: place('Osaka'),  capacity: 5, confirmedCount: 2, status: 'draft' })
const t2 = tour({ id: 't2', tourDate: '2025-07-01', group: { id: 'g2', name: 'Beta', type: 'company' },  places: place('Tokyo'),  capacity: 10, confirmedCount: 8, status: 'published' })
const t3 = tour({ id: 't3', tourDate: '2025-08-01', group: { id: 'g3', name: 'Gamma', type: 'community' }, places: place('Kyoto'),  capacity: 15, confirmedCount: 12, status: 'completed' })

describe('sortTours', () => {
  describe('by tourDate', () => {
    it('sorts asc', () => {
      const result = sortTours([t3, t1, t2], 'tourDate', 'asc', 'en')
      expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't3'])
    })

    it('sorts desc', () => {
      const result = sortTours([t3, t1, t2], 'tourDate', 'desc', 'en')
      expect(result.map((t) => t.id)).toEqual(['t3', 't2', 't1'])
    })
  })

  describe('by group', () => {
    it('sorts asc', () => {
      const result = sortTours([t3, t1, t2], 'group', 'asc', 'en')
      expect(result.map((t) => t.group.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
    })

    it('sorts desc', () => {
      const result = sortTours([t3, t1, t2], 'group', 'desc', 'en')
      expect(result.map((t) => t.group.name)).toEqual(['Gamma', 'Beta', 'Alpha'])
    })
  })

  describe('by places', () => {
    it('sorts asc', () => {
      const result = sortTours([t3, t1, t2], 'places', 'asc', 'en')
      expect(result.map((t) => t.places[0].nameEn)).toEqual(['Kyoto', 'Osaka', 'Tokyo'])
    })

    it('sorts desc', () => {
      const result = sortTours([t3, t1, t2], 'places', 'desc', 'en')
      expect(result.map((t) => t.places[0].nameEn)).toEqual(['Tokyo', 'Osaka', 'Kyoto'])
    })
  })

  describe('by capacity', () => {
    it('sorts asc', () => {
      const result = sortTours([t3, t1, t2], 'capacity', 'asc', 'en')
      expect(result.map((t) => t.capacity)).toEqual([5, 10, 15])
    })

    it('sorts desc', () => {
      const result = sortTours([t3, t1, t2], 'capacity', 'desc', 'en')
      expect(result.map((t) => t.capacity)).toEqual([15, 10, 5])
    })
  })

  describe('by confirmedCount', () => {
    it('sorts asc', () => {
      const result = sortTours([t3, t1, t2], 'confirmedCount', 'asc', 'en')
      expect(result.map((t) => t.confirmedCount)).toEqual([2, 8, 12])
    })

    it('sorts desc', () => {
      const result = sortTours([t3, t1, t2], 'confirmedCount', 'desc', 'en')
      expect(result.map((t) => t.confirmedCount)).toEqual([12, 8, 2])
    })
  })

  describe('by status', () => {
    it('sorts asc', () => {
      const result = sortTours([t3, t1, t2], 'status', 'asc', 'en')
      expect(result.map((t) => t.status)).toEqual(['completed', 'draft', 'published'])
    })

    it('sorts desc', () => {
      const result = sortTours([t3, t1, t2], 'status', 'desc', 'en')
      expect(result.map((t) => t.status)).toEqual(['published', 'draft', 'completed'])
    })
  })

  it('does not mutate the original array', () => {
    const original = [t3, t1, t2]
    sortTours(original, 'tourDate', 'asc', 'en')
    expect(original.map((t) => t.id)).toEqual(['t3', 't1', 't2'])
  })

  it('returns empty array unchanged', () => {
    expect(sortTours([], 'tourDate', 'asc', 'en')).toEqual([])
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
  sessionId: 's1',
  sessionOrder: 1,
  sessionLabel: null,
  displayName: 'Alice',
  status: 'confirmed',
  bookedAt: '2025-01-01T00:00:00Z',
  cancellationReason: null,
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

// ── downloadTourCalendar ──────────────────────────────────────────────────

describe('downloadTourCalendar', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with the blob on success', async () => {
    const blob = new Blob(['BEGIN:VCALENDAR'], { type: 'text/calendar' })
    mockDownloadAdminTourCalendar.mockResolvedValue(blob)
    const result = await downloadTourCalendar('t1')
    expect(result).toEqual({ ok: true, data: blob })
    expect(mockDownloadAdminTourCalendar).toHaveBeenCalledWith('t1')
  })

  it('returns not_found for 404', async () => {
    mockDownloadAdminTourCalendar.mockRejectedValue(new ApiError('not found', 404))
    const result = await downloadTourCalendar('t1')
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })
})

// ── createTour ─────────────────────────────────────────────────────────────

describe('createTour', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockCreateAdminTour.mockResolvedValue(stubTour)
    const result = await createTour({ groupId: 'g1', tourDate: '2025-06-01', meetingTime: '09:00', placeIds: ['place-1'], capacity: 10, bookingOpen: false, cancellationDeadline: '2025-05-31', notificationOffsets: '3, 1' })
    expect(result).toEqual({ ok: true, data: stubTour })
  })

  it('returns network for non-ApiError throw', async () => {
    mockCreateAdminTour.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await createTour({ groupId: 'g1', tourDate: '2025-06-01', meetingTime: '09:00', placeIds: ['place-1'], capacity: 10, bookingOpen: false, cancellationDeadline: '2025-05-31', notificationOffsets: '3, 1' })
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })

  it('returns unknown for unmapped status', async () => {
    mockCreateAdminTour.mockRejectedValue(new ApiError('server error', 500))
    const result = await createTour({ groupId: 'g1', tourDate: '2025-06-01', meetingTime: '09:00', placeIds: ['place-1'], capacity: 10, bookingOpen: false, cancellationDeadline: '2025-05-31', notificationOffsets: '3, 1' })
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

// ── fetchSessionTierCapacities ────────────────────────────────────────────

const stubCapacities: TierCapacities = { junior: 20, non_junior: 30, anyone: 50 }

describe('fetchSessionTierCapacities', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with data on success', async () => {
    mockGetTierCapacities.mockResolvedValue(stubCapacities)
    const result = await fetchSessionTierCapacities('t1', 's1')
    expect(result).toEqual({ ok: true, data: stubCapacities })
    expect(mockGetTierCapacities).toHaveBeenCalledWith('t1', 's1')
  })

  it('returns not_found for 404', async () => {
    mockGetTierCapacities.mockRejectedValue(new ApiError('not found', 404))
    const result = await fetchSessionTierCapacities('t1', 's1')
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })

  it('returns network for non-ApiError throw', async () => {
    mockGetTierCapacities.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await fetchSessionTierCapacities('t1', 's1')
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

// ── saveSessionTierCapacities ─────────────────────────────────────────────

describe('saveSessionTierCapacities', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok with updated data on success', async () => {
    mockSaveTierCapacities.mockResolvedValue(stubCapacities)
    const result = await saveSessionTierCapacities('t1', 's1', stubCapacities)
    expect(result).toEqual({ ok: true, data: stubCapacities })
    expect(mockSaveTierCapacities).toHaveBeenCalledWith('t1', 's1', stubCapacities)
  })

  it('returns not_found for 404', async () => {
    mockSaveTierCapacities.mockRejectedValue(new ApiError('not found', 404))
    const result = await saveSessionTierCapacities('t1', 's1', stubCapacities)
    expect(result).toEqual({ ok: false, error: { code: 'not_found' } })
  })

  it('returns network for non-ApiError throw', async () => {
    mockSaveTierCapacities.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await saveSessionTierCapacities('t1', 's1', stubCapacities)
    expect(result).toEqual({ ok: false, error: { code: 'network' } })
  })
})

// ── filterTours ────────────────────────────────────────────────────────────

const TODAY = '2025-07-15'

const f = (overrides: Partial<TourFilters> = {}): TourFilters => ({ ...emptyTourFilters, ...overrides })

describe('filterTours', () => {
  it('returns everything when no filter is active', () => {
    expect(filterTours([t1, t2, t3], emptyTourFilters, TODAY)).toHaveLength(3)
  })

  it('matches the search term against the group name, case-insensitively', () => {
    const result = filterTours([t1, t2, t3], f({ search: 'bet' }), TODAY)
    expect(result.map((t) => t.id)).toEqual(['t2'])
  })

  it('matches the search term against the place names', () => {
    const result = filterTours([t1, t2, t3], f({ search: 'kyo' }), TODAY)
    expect(result.map((t) => t.id)).toEqual(['t2', 't3'])
  })

  it('ignores surrounding whitespace in the search term', () => {
    expect(filterTours([t1, t2, t3], f({ search: '  alpha  ' }), TODAY).map((t) => t.id)).toEqual(['t1'])
  })

  it('returns nothing when the search term matches neither field', () => {
    expect(filterTours([t1, t2, t3], f({ search: 'nagoya' }), TODAY)).toEqual([])
  })

  it('does not match across the group name and place name boundary', () => {
    expect(filterTours([t1], f({ search: 'alphaosaka' }), TODAY)).toEqual([])
  })

  it('keeps only the selected statuses', () => {
    const result = filterTours([t1, t2, t3], f({ statuses: ['draft', 'completed'] }), TODAY)
    expect(result.map((t) => t.id)).toEqual(['t1', 't3'])
  })

  it('keeps only the selected group types', () => {
    const result = filterTours([t1, t2, t3], f({ groupTypes: ['company'] }), TODAY)
    expect(result.map((t) => t.id)).toEqual(['t2'])
  })

  it('keeps only upcoming tours, counting today as upcoming', () => {
    const today = tour({ id: 'today', tourDate: TODAY })
    const result = filterTours([t1, t2, t3, today], f({ dateRange: 'upcoming' }), TODAY)
    expect(result.map((t) => t.id)).toEqual(['t3', 'today'])
  })

  it('keeps only past tours', () => {
    const result = filterTours([t1, t2, t3], f({ dateRange: 'past' }), TODAY)
    expect(result.map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('combines search and filters with AND', () => {
    const result = filterTours([t1, t2, t3], f({ search: 'kyo', statuses: ['completed'] }), TODAY)
    expect(result.map((t) => t.id)).toEqual(['t3'])
  })

  it('returns nothing when filters that each match alone conflict', () => {
    const result = filterTours([t1, t2, t3], f({ search: 'alpha', groupTypes: ['company'] }), TODAY)
    expect(result).toEqual([])
  })
})

// ── isTourFilterActive ─────────────────────────────────────────────────────

describe('isTourFilterActive', () => {
  it('is false for the empty filters', () => {
    expect(isTourFilterActive(emptyTourFilters)).toBe(false)
  })

  it('is false for a whitespace-only search', () => {
    expect(isTourFilterActive(f({ search: '   ' }))).toBe(false)
  })

  it.each([
    ['search', f({ search: 'alpha' })],
    ['statuses', f({ statuses: ['draft'] })],
    ['dateRange', f({ dateRange: 'past' })],
    ['groupTypes', f({ groupTypes: ['school'] })],
  ])('is true when %s is set', (_label, filters) => {
    expect(isTourFilterActive(filters)).toBe(true)
  })
})

// ── filter ⇄ URL query params ──────────────────────────────────────────────

describe('tourFiltersToParams', () => {
  it('writes nothing for the empty filters', () => {
    expect(tourFiltersToParams(emptyTourFilters).toString()).toBe('')
  })

  it('writes every active filter', () => {
    const params = tourFiltersToParams(f({
      search: 'alpha',
      statuses: ['draft', 'published'],
      dateRange: 'upcoming',
      groupTypes: ['school'],
    }))
    expect(params.get('q')).toBe('alpha')
    expect(params.get('status')).toBe('draft,published')
    expect(params.get('range')).toBe('upcoming')
    expect(params.get('groupType')).toBe('school')
  })
})

describe('tourFiltersFromParams', () => {
  it('reads back what toParams wrote', () => {
    const filters = f({
      search: 'alpha',
      statuses: ['draft', 'published'],
      dateRange: 'upcoming',
      groupTypes: ['school'],
    })
    expect(tourFiltersFromParams(tourFiltersToParams(filters))).toEqual(filters)
  })

  it('falls back to the empty filters for an empty query string', () => {
    expect(tourFiltersFromParams(new URLSearchParams(''))).toEqual(emptyTourFilters)
  })

  it('drops values that are not valid enum members', () => {
    const params = new URLSearchParams('status=draft,bogus&groupType=nope&range=sideways')
    expect(tourFiltersFromParams(params)).toEqual(f({ statuses: ['draft'] }))
  })
})

describe('groupIdFromParams', () => {
  const groupId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  it('returns the group id when the param is a uuid', () => {
    expect(groupIdFromParams(new URLSearchParams(`groupId=${groupId}`))).toBe(groupId)
  })

  it('returns undefined when the param is absent', () => {
    expect(groupIdFromParams(new URLSearchParams(''))).toBeUndefined()
  })

  it('returns undefined when the param is not a uuid', () => {
    expect(groupIdFromParams(new URLSearchParams('groupId=not-a-uuid'))).toBeUndefined()
  })
})


// ── Calendar view params ───────────────────────────────────────────────────

describe('tourViewFromParams', () => {
  it('reads the calendar view from the query string', () => {
    expect(tourViewFromParams(new URLSearchParams('view=calendar'))).toBe('calendar')
  })

  it('defaults to the list when the param is absent', () => {
    expect(tourViewFromParams(new URLSearchParams(''))).toBe('list')
  })

  it('falls back to the list for an unrecognised view', () => {
    expect(tourViewFromParams(new URLSearchParams('view=gantt'))).toBe('list')
  })
})

describe('tourMonthFromParams', () => {
  it('reads a YYYY-MM month from the query string', () => {
    expect(tourMonthFromParams(new URLSearchParams('month=2025-03'), TODAY)).toBe('2025-03')
  })

  it("falls back to today's month when the param is absent", () => {
    expect(tourMonthFromParams(new URLSearchParams(''), TODAY)).toBe('2025-07')
  })

  it('rejects a malformed month rather than rendering an invalid grid', () => {
    expect(tourMonthFromParams(new URLSearchParams('month=2025-13'), TODAY)).toBe('2025-07')
    expect(tourMonthFromParams(new URLSearchParams('month=March'), TODAY)).toBe('2025-07')
  })
})

describe('tourPageToParams', () => {
  it('keeps the filters in the URL while the calendar is open', () => {
    const params = tourPageToParams(f({ search: 'Alpha' }), 'calendar', '2025-07', TODAY)
    expect(params.get('q')).toBe('Alpha')
    expect(params.get('view')).toBe('calendar')
  })

  it('omits the view param for the list, which is the default', () => {
    expect(tourPageToParams(emptyTourFilters, 'list', '2025-07', TODAY).has('view')).toBe(false)
  })

  it("omits the month param when the calendar is on today's month", () => {
    expect(tourPageToParams(emptyTourFilters, 'calendar', '2025-07', TODAY).has('month')).toBe(false)
  })

  it('writes the month once the calendar has been navigated away from today', () => {
    expect(tourPageToParams(emptyTourFilters, 'calendar', '2025-09', TODAY).get('month')).toBe('2025-09')
  })

  it('never writes a month while the list is showing', () => {
    expect(tourPageToParams(emptyTourFilters, 'list', '2025-09', TODAY).has('month')).toBe(false)
  })
})

// ── Month grid ─────────────────────────────────────────────────────────────

describe('monthGrid', () => {
  it('always returns six Monday-first weeks', () => {
    const cells = monthGrid('2025-07')
    expect(cells).toHaveLength(42)
    expect(new Date(`${cells[0].date}T00:00:00.000Z`).getUTCDay()).toBe(1)
  })

  it('pads the start of the month back to its Monday', () => {
    // 2025-07-01 is a Tuesday, so the grid opens on Monday 2025-06-30.
    const cells = monthGrid('2025-07')
    expect(cells[0]).toEqual({ date: '2025-06-30', inMonth: false })
    expect(cells[1]).toEqual({ date: '2025-07-01', inMonth: true })
  })

  it('does not pad a month that already starts on a Monday', () => {
    expect(monthGrid('2025-09')[0]).toEqual({ date: '2025-09-01', inMonth: true })
  })

  it('marks the trailing days as outside the month', () => {
    const cells = monthGrid('2025-07')
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31)
    expect(cells[41].inMonth).toBe(false)
  })

  it('covers February in a leap year', () => {
    const cells = monthGrid('2024-02')
    expect(cells.filter((c) => c.inMonth)).toHaveLength(29)
  })
})

describe('shiftMonth', () => {
  it('steps forward within a year', () => {
    expect(shiftMonth('2025-07', 1)).toBe('2025-08')
  })

  it('rolls over into the next year', () => {
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
  })

  it('rolls back into the previous year', () => {
    expect(shiftMonth('2025-01', -1)).toBe('2024-12')
  })
})

describe('toursByDate', () => {
  const withTime = (id: string, date: string, meetingTime: string) =>
    tour({ id, tourDate: date, sessions: [{ meetingTime } as TourSessionResponse] })

  it('keys tours by their date, dropping any time component', () => {
    const byDate = toursByDate([tour({ id: 't1', tourDate: '2025-07-04T00:00:00Z' })])
    expect(byDate.get('2025-07-04')?.map((t) => t.id)).toEqual(['t1'])
  })

  it('collects several tours falling on one day', () => {
    const byDate = toursByDate([
      withTime('late', '2025-07-04', '1970-01-01T13:00:00.000Z'),
      withTime('early', '2025-07-04', '1970-01-01T09:00:00.000Z'),
    ])
    expect(byDate.get('2025-07-04')?.map((t) => t.id)).toEqual(['early', 'late'])
  })

  it('sorts a sessionless tour last rather than ahead of every real one', () => {
    const byDate = toursByDate([
      tour({ id: 'no-sessions', tourDate: '2025-07-04', sessions: [] }),
      withTime('scheduled', '2025-07-04', '1970-01-01T09:00:00.000Z'),
    ])
    expect(byDate.get('2025-07-04')?.map((t) => t.id)).toEqual(['scheduled', 'no-sessions'])
  })
})
