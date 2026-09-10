import { z } from 'zod'
import type { AdminTourDetailResponse, AdminTourSummaryResponse, TourAction, GroupResponse, TierCapacities, CreateTourSession, UpdateTourSession, CancellationReasonResponse, BookingStatus, AdminBookingStatusResponse, AdminProfileResponse, TourStatus, GroupType } from '@peace-buddy/types'
import { TourStatusSchema, GroupTypeSchema } from '@peace-buddy/types'
import type { SortDir } from '@/components/sort-icon'
import { routing } from '@/i18n/routing'
import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '../../../../lib/action'
import { classifyApiError } from '../../../../lib/api-error'
import { ASC, DESC } from '../../../../lib/constants'

export type TourListSortField = 'tourDate' | 'group' | 'location' | 'capacity' | 'participantCount' | 'confirmedCount' | 'status'
export type BookingSortField = 'displayName' | 'status' | 'bookedAt'

// ── Tour list sorting ──────────────────────────────────────────────────────

export function sortTours(
  tours: AdminTourSummaryResponse[],
  field: TourListSortField,
  dir: SortDir,
): AdminTourSummaryResponse[] {
  return [...tours].sort((a, b) => {
    let cmp = 0
    switch (field) {
      case 'tourDate':      cmp = a.tourDate.localeCompare(b.tourDate); break
      case 'group':         cmp = a.group.name.localeCompare(b.group.name, routing.defaultLocale); break
      case 'location':      cmp = a.location.localeCompare(b.location, routing.defaultLocale); break
      case 'capacity':      cmp = a.capacity - b.capacity; break
      case 'participantCount': cmp = a.participantCount - b.participantCount; break
      case 'confirmedCount': cmp = a.confirmedCount - b.confirmedCount; break
      case 'status':        cmp = a.status.localeCompare(b.status); break
    }
    return dir === ASC ? cmp : -cmp
  })
}

export function nextTourListSort(
  current: { field: TourListSortField; dir: SortDir },
  clicked: TourListSortField,
): { field: TourListSortField; dir: SortDir } {
  if (clicked === current.field) {
    return { field: current.field, dir: current.dir === ASC ? DESC : ASC }
  }
  return { field: clicked, dir: ASC }
}

// ── Tour list filtering ────────────────────────────────────────────────────

export const TourDateRangeSchema = z.enum(['all', 'upcoming', 'past'])
export type TourDateRange = z.infer<typeof TourDateRangeSchema>

export type TourFilters = {
  search: string
  statuses: TourStatus[]
  dateRange: TourDateRange
  groupTypes: GroupType[]
  belowMinimumOnly: boolean
}

export const emptyTourFilters: TourFilters = {
  search: '',
  statuses: [],
  dateRange: TourDateRangeSchema.enum.all,
  groupTypes: [],
  belowMinimumOnly: false,
}

export function isTourFilterActive(filters: TourFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.statuses.length > 0 ||
    filters.dateRange !== TourDateRangeSchema.enum.all ||
    filters.groupTypes.length > 0 ||
    filters.belowMinimumOnly
  )
}

/** Case-insensitive substring match on group name and location, then AND of every active filter. */
export function filterTours(
  tours: AdminTourSummaryResponse[],
  filters: TourFilters,
  today: string,
): AdminTourSummaryResponse[] {
  const term = filters.search.trim().toLowerCase()
  return tours.filter((tour) => {
    if (term && ![tour.group.name, tour.location].some((f) => f.toLowerCase().includes(term))) return false
    if (filters.statuses.length > 0 && !filters.statuses.includes(tour.status)) return false
    if (filters.groupTypes.length > 0 && !filters.groupTypes.includes(tour.group.type)) return false
    if (filters.belowMinimumOnly && !tour.sessions.some((s) => s.belowMinimum)) return false
    if (filters.dateRange !== TourDateRangeSchema.enum.all) {
      const upcoming = tour.tourDate.slice(0, 10) >= today
      if (upcoming !== (filters.dateRange === TourDateRangeSchema.enum.upcoming)) return false
    }
    return true
  })
}

// ── Tour list filter ⇄ URL query params ────────────────────────────────────

const SEARCH_PARAM = 'q'
const STATUS_PARAM = 'status'
const RANGE_PARAM = 'range'
const GROUP_TYPE_PARAM = 'groupType'
const BELOW_MIN_PARAM = 'belowMin'

function parseList<T extends string>(raw: string | null, schema: z.ZodType<T>): T[] {
  if (!raw) return []
  return raw.split(',').flatMap((v) => {
    const parsed = schema.safeParse(v)
    return parsed.success ? [parsed.data] : []
  })
}

/** Unrecognised values are dropped rather than throwing — the query string is user-editable. */
export function tourFiltersFromParams(params: URLSearchParams): TourFilters {
  const range = TourDateRangeSchema.safeParse(params.get(RANGE_PARAM))
  return {
    search: params.get(SEARCH_PARAM) ?? '',
    statuses: parseList(params.get(STATUS_PARAM), TourStatusSchema),
    dateRange: range.success ? range.data : TourDateRangeSchema.enum.all,
    groupTypes: parseList(params.get(GROUP_TYPE_PARAM), GroupTypeSchema),
    belowMinimumOnly: params.get(BELOW_MIN_PARAM) === '1',
  }
}

export function tourFiltersToParams(filters: TourFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search.trim()) params.set(SEARCH_PARAM, filters.search)
  if (filters.statuses.length > 0) params.set(STATUS_PARAM, filters.statuses.join(','))
  if (filters.dateRange !== TourDateRangeSchema.enum.all) params.set(RANGE_PARAM, filters.dateRange)
  if (filters.groupTypes.length > 0) params.set(GROUP_TYPE_PARAM, filters.groupTypes.join(','))
  if (filters.belowMinimumOnly) params.set(BELOW_MIN_PARAM, '1')
  return params
}

// ── Booking sorting ────────────────────────────────────────────────────────

export function sortBookings(
  bookings: AdminTourDetailResponse['bookings'],
  field: BookingSortField,
  dir: SortDir,
): AdminTourDetailResponse['bookings'] {
  return [...bookings].sort((a, b) => {
    let cmp = 0
    switch (field) {
      case 'displayName': cmp = a.displayName.localeCompare(b.displayName, routing.defaultLocale); break
      case 'status':      cmp = a.status.localeCompare(b.status); break
      case 'bookedAt':    cmp = a.bookedAt.localeCompare(b.bookedAt); break
    }
    return dir === ASC ? cmp : -cmp
  })
}

export function nextBookingSort(
  current: { field: BookingSortField; dir: SortDir },
  clicked: BookingSortField,
): { field: BookingSortField; dir: SortDir } {
  if (clicked === current.field) {
    return { field: current.field, dir: current.dir === ASC ? DESC : ASC }
  }
  return { field: clicked, dir: ASC }
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function fetchTours(): Promise<ActionResult<AdminTourSummaryResponse[]>> {
  try {
    return { ok: true, data: await apiClient.listAdminTours() }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function fetchGroups(): Promise<ActionResult<GroupResponse[]>> {
  try {
    return { ok: true, data: await apiClient.listGroups() }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function fetchTour(id: string): Promise<ActionResult<AdminTourDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.getAdminTour(id) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function createTour(data: Record<string, unknown>): Promise<ActionResult<AdminTourDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.createAdminTour(data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateTour(id: string, data: Record<string, unknown>): Promise<ActionResult<AdminTourDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.updateAdminTour(id, data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function transitionTour(id: string, action: TourAction): Promise<ActionResult<AdminTourDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.transitionAdminTourStatus(id, action) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function toggleTourBooking(id: string, currentBookingOpen: boolean): Promise<ActionResult<AdminTourDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.updateAdminTour(id, { bookingOpen: !currentBookingOpen }) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function deleteTour(id: string): Promise<ActionResult> {
  try {
    await apiClient.deleteAdminTour(id)
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function fetchSessionTierCapacities(tourId: string, sessionId: string): Promise<ActionResult<TierCapacities>> {
  try {
    return { ok: true, data: await apiClient.getSessionTierCapacities(tourId, sessionId) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function saveSessionTierCapacities(tourId: string, sessionId: string, data: TierCapacities): Promise<ActionResult<TierCapacities>> {
  try {
    return { ok: true, data: await apiClient.saveSessionTierCapacities(tourId, sessionId, data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function addTourSession(tourId: string, data: CreateTourSession): Promise<ActionResult<AdminTourDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.addAdminTourSession(tourId, data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateTourSession(tourId: string, sessionId: string, data: UpdateTourSession): Promise<ActionResult<AdminTourDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.updateAdminTourSession(tourId, sessionId, data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function removeTourSession(tourId: string, sessionId: string): Promise<ActionResult<AdminTourDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.deleteAdminTourSession(tourId, sessionId) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateCancellationReason(bookingId: string, unavoidable: boolean | null): Promise<ActionResult<CancellationReasonResponse>> {
  try {
    return { ok: true, data: await apiClient.updateCancellationReason(bookingId, unavoidable) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus): Promise<ActionResult<AdminBookingStatusResponse>> {
  try {
    return { ok: true, data: await apiClient.updateBookingStatus(bookingId, status) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function fetchAllAdminProfiles(): Promise<ActionResult<AdminProfileResponse[]>> {
  try {
    return { ok: true, data: await apiClient.listAdminProfiles() }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function assignTourAdmin(tourId: string, adminId: string): Promise<ActionResult<AdminTourDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.assignTourAdmin(tourId, adminId) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function unassignTourAdmin(tourId: string, adminId: string): Promise<ActionResult<AdminTourDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.unassignTourAdmin(tourId, adminId) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function setTourStaffInCharge(tourId: string, adminId: string | null): Promise<ActionResult<AdminTourDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.setTourStaffInCharge(tourId, adminId) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
