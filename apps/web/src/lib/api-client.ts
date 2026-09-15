import { apiRequest, apiUpload } from './api'
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
  AdminDashboardResponse,
  BookingResponse,
  UpdateBookingBody,
  CancellationReasonBody,
  CancellationReasonResponse,
  MyTourBookingEntry,
  BuddyStatus,
  BuddyTier,
  MemberType,
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
  CreateTourSession,
  UpdateTourSession,
  BookingStatus,
  AdminBookingStatusResponse,
  NotificationsListResponse,
  MarkNotificationsRead,
  NotificationPreferencesResponse,
  UpdateNotificationPreferences,
} from '@peace-buddy/types'

export const apiClient = {
  // Admin — Dashboard
  getAdminDashboard: () =>
    apiRequest<AdminDashboardResponse>(apiPaths.adminDashboard),

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
  listBuddies: (status?: BuddyStatus, tier?: BuddyTier, memberType?: MemberType) => {
    const params: string[] = []
    if (status) params.push(`status=${status}`)
    if (tier) params.push(`tier=${tier}`)
    if (memberType) params.push(`memberType=${memberType}`)
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

  addAdminTourSession: (tourId: string, data: CreateTourSession) =>
    apiRequest<AdminTourDetailResponse>(apiPaths.adminTourSessions(tourId), {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAdminTourSession: (tourId: string, sessionId: string, data: UpdateTourSession) =>
    apiRequest<AdminTourDetailResponse>(apiPaths.adminTourSession(tourId, sessionId), {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAdminTourSession: (tourId: string, sessionId: string) =>
    apiRequest<AdminTourDetailResponse>(apiPaths.adminTourSession(tourId, sessionId), { method: 'DELETE' }),

  getSessionTierCapacities: (tourId: string, sessionId: string) =>
    apiRequest<TierCapacities>(apiPaths.adminSessionTierCapacities(tourId, sessionId)),

  saveSessionTierCapacities: (tourId: string, sessionId: string, data: TierCapacities) =>
    apiRequest<TierCapacities>(apiPaths.adminSessionTierCapacities(tourId, sessionId), {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Admin — Tour admin assignment
  assignTourAdmin: (tourId: string, adminId: string) =>
    apiRequest<AdminTourDetailResponse>(apiPaths.adminTourAdmins(tourId), {
      method: 'POST',
      body: JSON.stringify({ adminId }),
    }),

  unassignTourAdmin: (tourId: string, adminId: string) =>
    apiRequest<AdminTourDetailResponse>(apiPaths.adminTourAdmin(tourId, adminId), { method: 'DELETE' }),

  setTourStaffInCharge: (tourId: string, adminId: string | null) =>
    apiRequest<AdminTourDetailResponse>(apiPaths.adminTourStaffInCharge(tourId), {
      method: 'PUT',
      body: JSON.stringify({ adminId }),
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

  createBooking: (tourId: string, sessionId: string) =>
    apiRequest<BookingResponse>(apiPaths.tourBookings(tourId), {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }),

  updateBooking: (tourId: string, sessionId: string, status: UpdateBookingBody['status'], reason?: CancellationReasonBody) =>
    apiRequest<BookingResponse>(apiPaths.tourSessionBookingMe(tourId, sessionId), {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    }),

  reportCantGo: (tourId: string, sessionId: string, data: CancellationReasonBody) =>
    apiRequest<BookingResponse>(apiPaths.tourSessionCantGo(tourId, sessionId), {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCancellationReason: (bookingId: string, unavoidable: boolean | null) =>
    apiRequest<CancellationReasonResponse>(apiPaths.adminBookingCancellationReason(bookingId), {
      method: 'PATCH',
      body: JSON.stringify({ unavoidable }),
    }),

  updateBookingStatus: (bookingId: string, status: BookingStatus) =>
    apiRequest<AdminBookingStatusResponse>(apiPaths.adminBookingStatus(bookingId), {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getMyBookings: () =>
    apiRequest<MyTourBookingEntry[]>(apiPaths.meBookings),

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
  markOnboardingSeen: () =>
    apiRequest<BuddyProfileResponse>(apiPaths.meProfileOnboardingSeen, { method: 'POST' }),
  uploadMyPhoto: (file: Blob, filename: string) => {
    const form = new FormData()
    form.append('photo', file, filename)
    return apiUpload<BuddyProfileResponse>(apiPaths.meProfilePhoto, form)
  },
  deleteMyPhoto: () =>
    apiRequest<BuddyProfileResponse>(apiPaths.meProfilePhoto, { method: 'DELETE' }),

  // Notifications
  listNotifications: () =>
    apiRequest<NotificationsListResponse>(apiPaths.meNotifications),

  markNotificationsRead: (body: MarkNotificationsRead) =>
    apiRequest<{ ok: true }>(apiPaths.meNotificationsRead, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Admin — Notification preferences
  getAdminNotificationPreferences: () =>
    apiRequest<NotificationPreferencesResponse>(apiPaths.adminNotificationPreferences),

  updateAdminNotificationPreferences: (data: UpdateNotificationPreferences) =>
    apiRequest<NotificationPreferencesResponse>(apiPaths.adminNotificationPreferences, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}
