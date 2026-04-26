import { apiRequest } from './api'
import { apiPaths } from './api-paths'
import type {
  GroupResponse,
  GroupDetailResponse,
  CreateGroup,
  UpdateGroup,
  AdminBuddyResponse,
  TourResponse,
  TourDetailResponse,
  AdminTourSummaryResponse,
  AdminTourDetailResponse,
  BookingResponse,
  UpdateBookingBody,
  CancellationReasonBody,
  MyBookingEntry,
  BuddyStatus,
  TourStatus,
  TourStatusAction,
} from '@peace-buddy/types'

export const apiClient = {
  // Admin — Groups
  listGroups: () =>
    apiRequest<GroupResponse[]>(apiPaths.adminGroups),

  getGroup: (id: string) =>
    apiRequest<GroupDetailResponse>(apiPaths.adminGroup(id)),

  createGroup: (data: CreateGroup) =>
    apiRequest<GroupResponse>(apiPaths.adminGroups, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateGroup: (id: string, data: UpdateGroup) =>
    apiRequest<GroupResponse>(apiPaths.adminGroup(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Admin — Buddies
  listBuddies: (status?: BuddyStatus) =>
    apiRequest<AdminBuddyResponse[]>(
      status ? `${apiPaths.adminBuddies}?status=${status}` : apiPaths.adminBuddies,
    ),

  updateBuddyStatus: (id: string, data: Record<string, unknown>) =>
    apiRequest(apiPaths.adminBuddyStatus(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Admin — Tours
  listAdminTours: (status?: TourStatus) =>
    apiRequest<AdminTourSummaryResponse[]>(
      status ? `${apiPaths.adminTours}?status=${status}` : apiPaths.adminTours,
    ),

  getAdminTour: (id: string) =>
    apiRequest<AdminTourDetailResponse>(apiPaths.adminTour(id)),

  createAdminTour: (data: Record<string, unknown>) =>
    apiRequest<AdminTourDetailResponse>(apiPaths.adminTours, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAdminTour: (id: string, data: Record<string, unknown>) =>
    apiRequest<AdminTourDetailResponse>(apiPaths.adminTour(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  transitionAdminTourStatus: (id: string, action: TourStatusAction['action']) =>
    apiRequest<AdminTourDetailResponse>(apiPaths.adminTourStatus(id), {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }),

  deleteAdminTour: (id: string) =>
    apiRequest<void>(apiPaths.adminTour(id), { method: 'DELETE' }),

  // Buddy — Tours
  listTours: (from?: string) =>
    apiRequest<TourResponse[]>(
      from ? `${apiPaths.tours}?from=${from}` : apiPaths.tours,
    ),

  getTour: (id: string) =>
    apiRequest<TourDetailResponse>(apiPaths.tour(id)),

  createBooking: (tourId: string, initialStatus?: 'confirmed' | 'maybe' | 'declined') =>
    apiRequest<BookingResponse>(apiPaths.tourBookings(tourId), {
      method: 'POST',
      ...(initialStatus !== undefined && { body: JSON.stringify({ initialStatus }) }),
    }),

  updateBooking: (tourId: string, status: UpdateBookingBody['status'], reason?: CancellationReasonBody) =>
    apiRequest<BookingResponse>(apiPaths.tourBookingMe(tourId), {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    }),

  getMyBookings: () =>
    apiRequest<MyBookingEntry[]>(apiPaths.meBookings),
}
