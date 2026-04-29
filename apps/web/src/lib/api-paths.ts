export const apiPaths = {
  authRegister: '/auth/register',
  authMe: '/auth/me',

  meProfile: '/me/profile',
  meBookings: '/me/bookings',

  tours: '/tours',
  tour: (id: string) => `/tours/${id}`,
  tourBookings: (tourId: string) => `/tours/${tourId}/bookings`,
  tourBookingMe: (tourId: string) => `/tours/${tourId}/bookings/me`,

  adminBuddies: '/admin/buddies',
  adminBuddy: (id: string) => `/admin/buddies/${id}`,
  adminBuddyStatus: (id: string) => `/admin/buddies/${id}/status`,

  adminGroups: '/admin/groups',
  adminGroup: (id: string) => `/admin/groups/${id}`,

  adminTours: '/admin/tours',
  adminTour: (id: string) => `/admin/tours/${id}`,
  adminTourStatus: (id: string) => `/admin/tours/${id}/status`,
} as const
