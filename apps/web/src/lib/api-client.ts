import { apiRequest } from './api'
import { apiPaths } from './api-paths'
import type {
  GroupResponse,
  GroupDetailResponse,
  CreateGroup,
  UpdateGroup,
  AdminBuddyResponse,
  AdminBuddyDetailResponse,
  TourResponse,
  TourDetailResponse,
  AdminTourSummaryResponse,
  AdminTourDetailResponse,
  BookingResponse,
  UpdateBookingBody,
  CancellationReasonBody,
  MyBookingEntry,
  BuddyStatus,
  BuddyTier,
  TourStatus,
  TourStatusAction,
  UpdateAdminBuddyProfile,
  BuddyProfileResponse,
  UpdateBuddyProfile,
  AdminEvaluationResponse,
  CreateAdminEvaluation,
  UpdateAdminEvaluation,
  AdminProfileEvaluationResponse,
  UpsertAdminProfileEvaluation,
  AdminProfileResponse,
  AdminSelfEvaluationResponse,
  SelfEvaluationResponse,
  CreateSelfEvaluation,
  UpdateSelfEvaluation,
  TierCapacities,
} from '@peace-buddy/types'

export const apiClient = {
  // Admin — Profile
  getAdminProfile: () =>
    apiRequest<AdminProfileResponse>(apiPaths.adminProfile),

  updateAdminProfile: (name: string) =>
    apiRequest<AdminProfileResponse>(apiPaths.adminProfile, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  listAdminProfiles: () =>
    apiRequest<AdminProfileResponse[]>(apiPaths.adminProfiles),

  softDeleteAdminProfile: (userId: string) =>
    apiRequest<AdminProfileResponse>(apiPaths.adminProfileById(userId), { method: 'DELETE' }),

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
  listBuddies: (status?: BuddyStatus, tier?: BuddyTier) => {
    const params: string[] = []
    if (status) params.push(`status=${status}`)
    if (tier) params.push(`tier=${tier}`)
    const url = params.length ? `${apiPaths.adminBuddies}?${params.join('&')}` : apiPaths.adminBuddies
    return apiRequest<AdminBuddyResponse[]>(url)
  },

  getBuddy: (id: string) =>
    apiRequest<AdminBuddyDetailResponse>(apiPaths.adminBuddy(id)),

  updateBuddy: (id: string, data: UpdateAdminBuddyProfile) =>
    apiRequest<AdminBuddyResponse>(apiPaths.adminBuddy(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

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

  getAdminTourTierCapacities: (id: string) =>
    apiRequest<TierCapacities>(apiPaths.adminTourTierCapacities(id)),

  saveAdminTourTierCapacities: (id: string, data: TierCapacities) =>
    apiRequest<TierCapacities>(apiPaths.adminTourTierCapacities(id), {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Admin — Evaluations
  listAdminEvaluations: (params: { buddyId?: string; tourId?: string }) => {
    const qs = new URLSearchParams()
    if (params.buddyId) qs.set('buddyId', params.buddyId)
    if (params.tourId) qs.set('tourId', params.tourId)
    const query = qs.toString()
    return apiRequest<AdminEvaluationResponse[]>(query ? `${apiPaths.adminEvaluations}?${query}` : apiPaths.adminEvaluations)
  },

  getAdminEvaluation: (id: string) =>
    apiRequest<AdminEvaluationResponse>(apiPaths.adminEvaluation(id)),

  createAdminEvaluation: (data: CreateAdminEvaluation) =>
    apiRequest<AdminEvaluationResponse>(apiPaths.adminEvaluations, { method: 'POST', body: JSON.stringify(data) }),

  updateAdminEvaluation: (id: string, data: UpdateAdminEvaluation) =>
    apiRequest<AdminEvaluationResponse>(apiPaths.adminEvaluation(id), { method: 'PUT', body: JSON.stringify(data) }),

  deleteAdminEvaluation: (id: string) =>
    apiRequest<void>(apiPaths.adminEvaluation(id), { method: 'DELETE' }),

  getAdminProfileEvaluation: (buddyId: string) =>
    apiRequest<AdminProfileEvaluationResponse>(apiPaths.adminProfileEvaluationMine(buddyId)),

  listAdminProfileEvaluations: (buddyId: string) =>
    apiRequest<AdminProfileEvaluationResponse[]>(apiPaths.adminProfileEvaluation(buddyId)),

  upsertAdminProfileEvaluation: (buddyId: string, data: UpsertAdminProfileEvaluation) =>
    apiRequest<AdminProfileEvaluationResponse>(apiPaths.adminProfileEvaluation(buddyId), { method: 'PUT', body: JSON.stringify(data) }),

  listAdminSelfEvaluations: (params: { buddyId?: string }) =>
    apiRequest<AdminSelfEvaluationResponse[]>(
      params.buddyId ? `${apiPaths.adminSelfEvaluations}?buddyId=${params.buddyId}` : apiPaths.adminSelfEvaluations,
    ),

  getAdminSelfEvaluation: (id: string) =>
    apiRequest<AdminSelfEvaluationResponse>(apiPaths.adminSelfEvaluation(id)),

  // Buddy — Tours
  listTours: (from?: string) =>
    apiRequest<TourResponse[]>(
      from ? `${apiPaths.tours}?from=${from}` : apiPaths.tours,
    ),

  getTour: (id: string) =>
    apiRequest<TourDetailResponse>(apiPaths.tour(id)),

  createBooking: (tourId: string) =>
    apiRequest<BookingResponse>(apiPaths.tourBookings(tourId), { method: 'POST' }),

  updateBooking: (tourId: string, status: UpdateBookingBody['status'], reason?: CancellationReasonBody) =>
    apiRequest<BookingResponse>(apiPaths.tourBookingMe(tourId), {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    }),

  getMyBookings: () =>
    apiRequest<MyBookingEntry[]>(apiPaths.meBookings),

  // Buddy — Self-evaluations
  listMySelfEvaluations: (params: { tourId?: string } = {}) =>
    apiRequest<SelfEvaluationResponse[]>(
      params.tourId ? `${apiPaths.selfEvaluations}?tourId=${params.tourId}` : apiPaths.selfEvaluations,
    ),

  createSelfEvaluation: (data: CreateSelfEvaluation) =>
    apiRequest<SelfEvaluationResponse>(apiPaths.selfEvaluations, { method: 'POST', body: JSON.stringify(data) }),

  updateSelfEvaluation: (id: string, data: UpdateSelfEvaluation) =>
    apiRequest<SelfEvaluationResponse>(apiPaths.selfEvaluation(id), { method: 'PUT', body: JSON.stringify(data) }),

  // Buddy — Profile
  getMyProfile: () =>
    apiRequest<BuddyProfileResponse>(apiPaths.meProfile),
  updateMyProfile: (data: UpdateBuddyProfile) =>
    apiRequest<BuddyProfileResponse>(apiPaths.meProfile, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}
