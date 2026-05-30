import type { AdminTourDetailResponse, AdminTourSummaryResponse, TourAction, GroupResponse, TierCapacities, CreateTourSession, UpdateTourSession, CancellationReasonResponse, BookingStatus, AdminBookingStatusResponse } from '@peace-buddy/types'
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
