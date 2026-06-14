export const apiPaths = {
  authRegister: '/auth/register',
  authMe: '/auth/me',
  authMeLocale: '/auth/me/locale',

  meProfile: '/me/profile',
  meProfilePhoto: '/me/profile/photo',
  meBookings: '/me/bookings',
  meNotifications: '/me/notifications',
  meNotificationsRead: '/me/notifications/read',

  tours: '/tours',
  tour: (id: string) => `/tours/${id}`,
  tourBookings: (tourId: string) => `/tours/${tourId}/bookings`,
  tourSessionBookingMe: (tourId: string, sessionId: string) => `/tours/${tourId}/sessions/${sessionId}/bookings/me`,
  tourSessionCantGo: (tourId: string, sessionId: string) => `/tours/${tourId}/sessions/${sessionId}/bookings/me/cant-go`,

  adminBuddies: '/admin/buddies',
  adminBuddy: (id: string) => `/admin/buddies/${id}`,
  adminBuddyStatus: (id: string) => `/admin/buddies/${id}/status`,
  adminBookingCancellationReason: (bookingId: string) => `/admin/bookings/${bookingId}/cancellation-reason`,
  adminBookingStatus: (bookingId: string) => `/admin/bookings/${bookingId}/status`,

  adminGroups: '/admin/groups',
  adminGroup: (id: string) => `/admin/groups/${id}`,

  adminTours: '/admin/tours',
  adminTour: (id: string) => `/admin/tours/${id}`,
  adminTourStatus: (id: string) => `/admin/tours/${id}/status`,
  adminTourSessions: (tourId: string) => `/admin/tours/${tourId}/sessions`,
  adminTourSession: (tourId: string, sessionId: string) => `/admin/tours/${tourId}/sessions/${sessionId}`,
  adminSessionTierCapacities: (tourId: string, sessionId: string) => `/admin/tours/${tourId}/sessions/${sessionId}/tier-capacities`,
  adminTourAdmins: (tourId: string) => `/admin/tours/${tourId}/admins`,
  adminTourAdmin: (tourId: string, adminId: string) => `/admin/tours/${tourId}/admins/${adminId}`,
  adminTourStaffInCharge: (tourId: string) => `/admin/tours/${tourId}/staff-in-charge`,

  adminEvaluations: '/admin/evaluations',
  adminEvaluation: (id: string) => `/admin/evaluations/${id}`,
  adminProfileEvaluation: (buddyId: string) => `/admin/profile-evaluations/${buddyId}`,
  adminProfileEvaluationMine: (buddyId: string) => `/admin/profile-evaluations/${buddyId}/mine`,
  adminSelfEvaluations: '/admin/self-evaluations',
  adminSelfEvaluation: (id: string) => `/admin/self-evaluations/${id}`,

  adminProfile: '/admin/profile',
  adminProfiles: '/admin/profiles',
  adminProfileById: (userId: string) => `/admin/profiles/${userId}`,

  selfEvaluations: '/me/self-evaluations',
  selfEvaluation: (id: string) => `/me/self-evaluations/${id}`,

} as const
