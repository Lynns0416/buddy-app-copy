import { z } from 'zod'

// Enums

export const UserRoleSchema = z.enum(['buddy', 'admin', 'super_admin'])
export type UserRole = z.infer<typeof UserRoleSchema>

export const BuddyStatusSchema = z.enum(['pending', 'trainee', 'active', 'rejected', 'suspended'])
export type BuddyStatus = z.infer<typeof BuddyStatusSchema>

export const BuddyTierSchema = z.enum(['junior', 'buddy', 'star', 'blackstar'] as const)
export type BuddyTier = z.infer<typeof BuddyTierSchema>

// What a person is to PLAB, not what they can do — see BuddyTierSchema for the
// latter. The two axes are independent: a plab_member holds a tier like anyone
// else, and memberType affects no eligibility, capacity or permission.
export const MemberTypeSchema = z.enum(['buddy', 'plab_member'] as const)
export type MemberType = z.infer<typeof MemberTypeSchema>

export const BookingStatusSchema = z.enum(['confirmed', 'maybe', 'waitlist', 'declined'])
export type BookingStatus = z.infer<typeof BookingStatusSchema>

export const TourStatusSchema = z.enum(['draft', 'published', 'cancelled', 'completed'])
export type TourStatus = z.infer<typeof TourStatusSchema>

export const GroupTypeSchema = z.enum(['school', 'company', 'community', 'other'])
export type GroupType = z.infer<typeof GroupTypeSchema>

export const CancellationCategorySchema = z.enum(['health', 'emergency', 'personal', 'work', 'other'])
export type CancellationCategory = z.infer<typeof CancellationCategorySchema>

export const LanguageSchema = z.enum([
  'english',
  'korean',
  'chinese_simplified',
  'chinese_traditional',
  'arabic',
  'french',
  'german',
  'italian',
  'japanese',
  'portuguese',
  'russian',
  'spanish',
  'thai',
  'vietnamese',
] as const)
export type Language = z.infer<typeof LanguageSchema>

// The admin half of the Prisma `NotifEventType` enum. Kept as its own schema
// rather than widened, so the admin screen and DEFAULT_ADMIN_EMAIL_PREFS cannot
// pick up buddy events by accident.
export const NotifEventTypeSchema = z.enum([
  'new_signup',
  'new_booking',
  'cancellation',
  'maybe_resolved',
  'maybe_deadline_missed',
])
export type NotifEventType = z.infer<typeof NotifEventTypeSchema>

// The buddy half. Every value is also a NotifEventKind — buddy preferences need
// no admin-style mapping, the preference key IS the dispatched event.
//
// Absent on purpose, and the omission is the enforcement rather than a UI
// choice: `tour_cancelled` and `waitlist_promoted` (a buddy who muted either
// turns up to a tour that isn't running, or misses that they hold a seat) and
// `account_approved` / `account_rejected`. They are not in the Prisma enum, so
// a row for them cannot be stored and the route rejects one.
// `waitlist_opened` and `self_eval_prompt` have no email template at all, so
// there is nothing to mute. See docs/decisions.md 2026-09-18.
export const BuddyNotifEventTypeSchema = z.enum([
  'tour_published',
  'tour_details_changed',
  'tour_reminder',
  'maybe_reminder',
])
export type BuddyNotifEventType = z.infer<typeof BuddyNotifEventTypeSchema>

// The Prisma `NotifEventType` column, which holds both halves. Used for rows
// read back out of NotificationPreference, where a single query can return
// admin and buddy events side by side.
export const NotifPrefEventTypeSchema = z.enum([
  ...NotifEventTypeSchema.options,
  ...BuddyNotifEventTypeSchema.options,
])
export type NotifPrefEventType = z.infer<typeof NotifPrefEventTypeSchema>

export const EmailModeSchema = z.enum(['immediate', 'digest'])
export type EmailMode = z.infer<typeof EmailModeSchema>

export const NotificationPreferenceItemSchema = z.object({
  eventType: NotifEventTypeSchema,
  emailEnabled: z.boolean(),
  emailMode: EmailModeSchema,
  slackEnabled: z.boolean(),
})
export type NotificationPreferenceItem = z.infer<typeof NotificationPreferenceItemSchema>

export const UpdateNotificationPreferencesSchema = z.object({
  preferences: z.array(NotificationPreferenceItemSchema),
})
export type UpdateNotificationPreferences = z.infer<typeof UpdateNotificationPreferencesSchema>

export type NotificationPreferencesResponse = {
  preferences: NotificationPreferenceItem[]
}

// Buddies get email on/off only. Slack is not a buddy channel (PRD §10.3) and
// the daily digest is an admin concept, so neither `emailMode` nor
// `slackEnabled` is exposed; buddy rows carry 'immediate' / false and nothing
// reads them.
export const BuddyNotificationPreferenceItemSchema = z.object({
  eventType: BuddyNotifEventTypeSchema,
  emailEnabled: z.boolean(),
})
export type BuddyNotificationPreferenceItem = z.infer<
  typeof BuddyNotificationPreferenceItemSchema
>

export const UpdateBuddyNotificationPreferencesSchema = z.object({
  preferences: z.array(BuddyNotificationPreferenceItemSchema),
})
export type UpdateBuddyNotificationPreferences = z.infer<
  typeof UpdateBuddyNotificationPreferencesSchema
>

export type BuddyNotificationPreferencesResponse = {
  preferences: BuddyNotificationPreferenceItem[]
}

export const BookingPoolSchema = z.enum(['junior', 'non_junior', 'anyone'])
export type BookingPool = z.infer<typeof BookingPoolSchema>

export const LocaleSchema = z.enum(['ja', 'en'])
export type Locale = z.infer<typeof LocaleSchema>

export const NotificationChannelSchema = z.enum(['in_app', 'email', 'slack'])
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>

export const NotificationJobStatusSchema = z.enum(['pending', 'sent', 'failed', 'dead'])
export type NotificationJobStatus = z.infer<typeof NotificationJobStatusSchema>

// Full set of dispatchable notification events. Distinct from NotifEventType
// (admin notification preferences) — this covers every PRD §10 event across
// buddy + admin recipients.
export const NotifEventKindSchema = z.enum([
  // Buddy-targeted
  'account_approved',
  'account_rejected',
  'tour_published',
  'tour_details_changed',
  'tour_cancelled',
  'tour_reminder',
  'maybe_reminder',
  'waitlist_promoted',
  'waitlist_opened',
  'self_eval_prompt',
  // Admin-targeted
  'new_signup',
  'new_booking',
  'booking_cancelled',
  'cant_go_post_deadline',
  'maybe_resolved',
  'maybe_deadline_missed',
])
export type NotifEventKind = z.infer<typeof NotifEventKindSchema>

// ---- Notification payloads ----
//
// One schema per dispatchable event. These describe what an enqueue site
// WRITES, so a typo in a field name fails typecheck instead of rendering a
// blank placeholder in a Slack post.
//
// They are deliberately not applied on the way out. `NotificationJob.payload`,
// `Notification.payload` and `DigestQueue.payload` are persisted Json columns
// with rows written before these fields existed; the renderers read the payload
// loosely and fall back to a generic, placeholder-free message when a field is
// missing (docs/decisions.md 2026-09-13).
//
// The display fields (`buddyName`, `groupName`, `tourDate`) are snapshots taken
// at enqueue time — a later rename does not retro-update an already-queued
// message. Same decision entry.

// Every tour-scoped event carries enough to name the tour in a message.
// `tourDate` is the UTC calendar date as `YYYY-MM-DD`, matching the `.slice(0, 10)`
// the web app applies to the ISO string the API returns.
const TourRefPayloadSchema = z.object({
  tourId: z.string(),
  groupName: z.string(),
  tourDate: z.string(),
})

// Booking-scoped admin events additionally name the acting buddy.
const BookingRefPayloadSchema = TourRefPayloadSchema.extend({
  bookingId: z.string(),
  sessionId: z.string(),
  buddyId: z.string(),
  buddyName: z.string(),
})

export const NotifPayloadSchemas = {
  // Buddy-targeted
  account_approved: z.object({}),
  account_rejected: z.object({}),
  tour_published: TourRefPayloadSchema,
  tour_details_changed: TourRefPayloadSchema,
  tour_cancelled: TourRefPayloadSchema,
  tour_reminder: TourRefPayloadSchema.extend({ offsetDays: z.number() }),
  maybe_reminder: TourRefPayloadSchema.extend({ offsetDays: z.number() }),
  waitlist_promoted: TourRefPayloadSchema.extend({
    bookingId: z.string(),
    sessionId: z.string(),
  }),
  waitlist_opened: TourRefPayloadSchema.extend({ sessionId: z.string() }),
  self_eval_prompt: TourRefPayloadSchema,
  // Admin-targeted
  new_signup: z.object({
    buddyUserId: z.string(),
    email: z.string(),
    displayName: z.string().nullable(),
  }),
  new_booking: BookingRefPayloadSchema.extend({ status: BookingStatusSchema }),
  booking_cancelled: BookingRefPayloadSchema,
  cant_go_post_deadline: BookingRefPayloadSchema.extend({
    category: CancellationCategorySchema,
  }),
  maybe_resolved: BookingRefPayloadSchema.extend({ resolution: BookingStatusSchema }),
  maybe_deadline_missed: TourRefPayloadSchema,
} as const satisfies Record<NotifEventKind, z.ZodTypeAny>

export type NotifPayloadMap = {
  [K in NotifEventKind]: z.infer<(typeof NotifPayloadSchemas)[K]>
}
export type NotifPayload<K extends NotifEventKind = NotifEventKind> = NotifPayloadMap[K]

export type NotificationResponse = {
  id: string
  type: NotifEventKind
  payload: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export type NotificationsListResponse = {
  items: NotificationResponse[]
  unreadCount: number
}

export type DispatchResult = {
  picked: number
  sent: number
  failed: number
  dead: number
  skipped: number
}

export type TourReminderResult = {
  tours: number
  // Total (recipient × matching-offset) pairs evaluated this run. By construction
  // `considered === enqueued + alreadySent`.
  considered: number
  enqueued: number
  alreadySent: number
}

export type MaybeReminderResult = TourReminderResult

export type MaybeDeadlineResult = {
  tours: number
  enqueuedTours: number
  alreadySent: number
}

export const MarkNotificationsReadSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1) }),
  z.object({ all: z.literal(true) }),
])
export type MarkNotificationsRead = z.infer<typeof MarkNotificationsReadSchema>

export const TierCapacitiesSchema = z.object({
  junior: z.number().int().min(0).max(100),
  non_junior: z.number().int().min(0).max(100),
  anyone: z.number().int().min(0).max(100),
}).refine((v: { junior: number; non_junior: number; anyone: number }) => v.junior + v.non_junior + v.anyone === 100, { message: 'Percentages must sum to 100' })
export type TierCapacities = z.infer<typeof TierCapacitiesSchema>

// `network` is client-only and is never emitted by the server
export const AppErrorCodeSchema = z.enum(['not_found', 'forbidden', 'conflict', 'invalid_request', 'payload_too_large', 'network', 'unknown'])
export type AppErrorCode = z.infer<typeof AppErrorCodeSchema>

export type AppError = { code: AppErrorCode; detail?: string }
export type ApiErrorResponse = { code: AppErrorCode; detail?: string }

// Auth

export const RegisterRequestBodySchema = z
  .object({
    displayName: z.string().optional(),
    realName: z.string().optional(),
    languages: z.array(LanguageSchema).optional(),
    bio: z.string().optional(),
  })
  .refine(
    (d: { languages?: string[] }) => !d.languages || d.languages.length === new Set(d.languages).size,
    { message: 'Duplicate languages are not allowed', path: ['languages'] }
  )
export type RegisterRequestBody = z.infer<typeof RegisterRequestBodySchema>

// Buddy Profile

export const UpdateBuddyProfileSchema = z
  .object({
    displayName: z.string().optional(),
    realName: z.string().optional(),
    bio: z.string().nullable().optional(),
    contactInfo: z.string().nullable().optional(),
    languages: z.array(LanguageSchema).optional(),
    skills: z.array(z.string()).optional(),
  })
  .refine(
    (d: { languages?: string[] }) => !d.languages || d.languages.length === new Set(d.languages).size,
    { message: 'Duplicate languages are not allowed', path: ['languages'] }
  )
export type UpdateBuddyProfile = z.infer<typeof UpdateBuddyProfileSchema>

// Tour (admin)

const timeRegex = /^\d{2}:\d{2}$/

export const CreateTourSessionSchema = z
  .object({
    label: z.string().optional(),
    meetingTime: z.string().regex(timeRegex),
    startTime: z.string().regex(timeRegex).optional(),
    endTime: z.string().regex(timeRegex).optional(),
    capacity: z.number().int().positive(),
    minBuddies: z.number().int().min(0).nullable().optional(),
    participantCount: z.number().int().min(0).optional(),
    placeId: z.string().uuid(),
  })
  .refine(
    (d: { capacity: number; minBuddies?: number | null }) =>
      d.minBuddies == null || d.minBuddies <= d.capacity,
    { message: 'minBuddies must be ≤ capacity', path: ['minBuddies'] },
  )
export type CreateTourSession = z.infer<typeof CreateTourSessionSchema>

export const UpdateTourSessionSchema = z
  .object({
    label: z.string().nullable().optional(),
    meetingTime: z.string().regex(timeRegex).optional(),
    startTime: z.string().regex(timeRegex).nullable().optional(),
    endTime: z.string().regex(timeRegex).nullable().optional(),
    capacity: z.number().int().positive().optional(),
    minBuddies: z.number().int().min(0).nullable().optional(),
    participantCount: z.number().int().min(0).optional(),
    placeId: z.string().uuid().optional(),
  })
  .refine(
    (d: { capacity?: number; minBuddies?: number | null }) =>
      d.capacity == null || d.minBuddies == null || d.minBuddies <= d.capacity,
    { message: 'minBuddies must be ≤ capacity', path: ['minBuddies'] },
  )
export type UpdateTourSession = z.infer<typeof UpdateTourSessionSchema>

export const CreateTourSchema = z
  .object({
    groupId: z.string().uuid(),
    tourDate: z.coerce.date(),
    bookingOpen: z.boolean().default(false),
    description: z.string().optional(),
    adminMemo: z.string().optional(),
    cancellationDeadline: z.coerce.date(),
    maybeDeadline: z.coerce.date().optional(),
    notificationOffsets: z.array(z.number().int().min(0)).default([3, 1]),
    sessions: z.array(CreateTourSessionSchema).min(1).max(2),
  })
  .refine((d: { maybeDeadline?: Date; cancellationDeadline: Date }) => !d.maybeDeadline || d.maybeDeadline < d.cancellationDeadline, {
    message: 'maybeDeadline must be before cancellationDeadline',
    path: ['maybeDeadline'],
  })
export type CreateTour = z.infer<typeof CreateTourSchema>

export const UpdateTourSchema = z
  .object({
    groupId: z.string().uuid().optional(),
    tourDate: z.coerce.date().optional(),
    bookingOpen: z.boolean().optional(),
    description: z.string().nullable().optional(),
    adminMemo: z.string().nullable().optional(),
    cancellationDeadline: z.coerce.date().optional(),
    maybeDeadline: z.coerce.date().nullable().optional(),
    notificationOffsets: z.array(z.number().int().min(0)).optional(),
  })
  .refine(
    (d: { maybeDeadline?: Date | null; cancellationDeadline?: Date }) => {
      if (d.maybeDeadline && d.cancellationDeadline) {
        return d.maybeDeadline < d.cancellationDeadline
      }
      return true
    },
    { message: 'maybeDeadline must be before cancellationDeadline', path: ['maybeDeadline'] },
  )
export type UpdateTour = z.infer<typeof UpdateTourSchema>

export const TourActionSchema = z.enum(['publish', 'cancel', 'complete'])
export type TourAction = z.infer<typeof TourActionSchema>

export const TourStatusActionSchema = z.object({
  action: TourActionSchema,
})
export type TourStatusAction = z.infer<typeof TourStatusActionSchema>

// Group

export const CreateGroupSchema = z.object({
  name: z.string().min(1),
  type: GroupTypeSchema,
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
})
export type CreateGroup = z.infer<typeof CreateGroupSchema>

export const UpdateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  type: GroupTypeSchema.optional(),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})
export type UpdateGroup = z.infer<typeof UpdateGroupSchema>

// Place / Spot — admin-managed lookup tables replacing free-text Tour.location.
// Retired via `active: false`, never deleted (docs/decisions.md — "Places and
// spots replace free-text location").

export const CreatePlaceSchema = z.object({
  nameJa: z.string().min(1),
  nameEn: z.string().min(1),
  sortOrder: z.number().int(),
  active: z.boolean().default(true),
})
export type CreatePlace = z.infer<typeof CreatePlaceSchema>

export const UpdatePlaceSchema = z.object({
  nameJa: z.string().min(1).optional(),
  nameEn: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
})
export type UpdatePlace = z.infer<typeof UpdatePlaceSchema>

export const CreateSpotSchema = z.object({
  nameJa: z.string().min(1),
  nameEn: z.string().min(1),
  sortOrder: z.number().int(),
  active: z.boolean().default(true),
})
export type CreateSpot = z.infer<typeof CreateSpotSchema>

// placeId is fixed at creation — renames are corrections only (rule 5), never
// a reassignment to a different place.
export const UpdateSpotSchema = z.object({
  nameJa: z.string().min(1).optional(),
  nameEn: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
})
export type UpdateSpot = z.infer<typeof UpdateSpotSchema>

export type PlaceResponse = {
  id: string
  nameJa: string
  nameEn: string
  sortOrder: number
  active: boolean
}

export type SpotResponse = {
  id: string
  placeId: string
  nameJa: string
  nameEn: string
  sortOrder: number
  active: boolean
}

export type PlaceDetailResponse = PlaceResponse & {
  spots: SpotResponse[]
}

// A place, everywhere only the name is shown — a session's place, and a tour's
// `places` (its sessions' places, deduplicated, in session order) on the tour
// list/detail, group tour history, buddy booking history, next-tour card, etc.
export type PlaceSummary = {
  id: string
  nameJa: string
  nameEn: string
}

// A session's place with its active spots — only where a buddy picks a spot
// for a reflection moment (TourSessionDetailResponse).
export type TourPlaceWithSpots = PlaceSummary & {
  spots: PlaceSummary[]
}

// Admin

export const UpdateBuddyStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('trainee') }),
  z.object({ status: z.literal('active') }),
  z.object({ status: z.literal('rejected') }),
])
export type UpdateBuddyStatus = z.infer<typeof UpdateBuddyStatusSchema>

export const UpdateAdminBuddyProfileSchema = z.object({
  tier: BuddyTierSchema.nullable().optional(),
  memberType: MemberTypeSchema.optional(),
  internalNotes: z.string().nullable().optional(),
})
export type UpdateAdminBuddyProfile = z.infer<typeof UpdateAdminBuddyProfileSchema>

// Admin Profile

export const CreateAdminProfileSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1),
})
export type CreateAdminProfile = z.infer<typeof CreateAdminProfileSchema>

export const UpdateAdminProfileSchema = z.object({
  name: z.string().min(1),
})
export type UpdateAdminProfile = z.infer<typeof UpdateAdminProfileSchema>

export type AdminProfileResponse = {
  id: string
  userId: string
  name: string
  createdAt: string
}

// Response types (HTTP wire format — dates serialized as ISO strings)

export type BuddyProfileResponse = {
  id: string
  status: BuddyStatus
  tier: BuddyTier | null
  displayName: string
  realName: string
  photoUrl: string | null
  bio: string | null
  contactInfo: string | null
  languages: Language[]
  skills: string[]
  onboardingSeenAt: string | null
  createdAt: string
  updatedAt: string
}

export type TourSessionResponse = {
  id: string
  order: number
  label: string | null
  meetingTime: string
  startTime: string | null
  endTime: string | null
  capacity: number
  minBuddies: number | null
  participantCount: number
  belowMinimum: boolean
  place: PlaceSummary
}

// A session as listed to a buddy. Kept apart from TourSessionResponse, which
// is also the admin tour and group session shape, where "my booking" means nothing.
export type TourListSessionResponse = TourSessionResponse & {
  myBookingStatus: BookingStatus | null
}

export type TourResponse = {
  id: string
  groupId: string
  group: { id: string; name: string; type: GroupType }
  status: TourStatus
  tourDate: string
  bookingOpen: boolean
  places: PlaceSummary[]
  participantCount: number
  description: string | null
  cancellationDeadline: string
  maybeDeadline: string | null
  notificationOffsets: number[]
  sessions: TourListSessionResponse[]
  createdAt: string
  updatedAt: string
}

export type GroupResponse = {
  id: string
  name: string
  type: GroupType
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type GroupTourSummary = {
  id: string
  status: TourStatus
  tourDate: string
  bookingOpen: boolean
  places: PlaceSummary[]
  participantCount: number
  description: string | null
  sessions: TourSessionResponse[]
  createdAt: string
}

export type GroupDetailResponse = GroupResponse & {
  tours: GroupTourSummary[]
}

// Admin-only response — includes tier and internalNotes
export type AdminBuddyResponse = {
  id: string
  userId: string
  status: BuddyStatus
  tier: BuddyTier | null
  memberType: MemberType
  displayName: string
  realName: string
  photoUrl: string | null
  email: string
  internalNotes: string | null
  createdAt: string
  updatedAt: string
}

export type AdminBuddyBookingEntry = {
  id: string
  tourId: string
  sessionId: string
  sessionOrder: number
  sessionLabel: string | null
  status: BookingStatus
  bookedAt: string
  cancellationReason: CancellationReasonResponse | null
  tour: {
    tourDate: string
    places: PlaceSummary[]
    group: { name: string }
    status: TourStatus
  }
}

export type AdminBuddyDetailResponse = AdminBuddyResponse & {
  buddyProfile: {
    bio: string | null
    contactInfo: string | null
    languages: Language[]
    skills: string[]
  } | null
  bookings: AdminBuddyBookingEntry[]
  cancellationSummary: CancellationSummary
  absenceSummary: { absentWithoutReport: number }
  // All-time numbers, the same ones `GET /admin/buddies/stats` returns.
  stats: BuddyStats
}

// Sanitized response — no admin-only fields
export type UserResponse = {
  id: string
  email: string
  role: UserRole
  locale: Locale
  createdAt: string
  buddyProfile: BuddyProfileResponse | null
}

export const UpdateLocaleSchema = z.object({ locale: LocaleSchema })
export type UpdateLocale = z.infer<typeof UpdateLocaleSchema>

export type TourSeatCounts = {
  confirmed: number
  maybe: number
  waitlist: number
  declined: number
}

export type TourSessionDetailResponse = Omit<TourListSessionResponse, 'place'> & {
  place: TourPlaceWithSpots
  seatCounts: TourSeatCounts
  remaining: number
  myCapacity: number | null
  myRemaining: number | null
}

export type TourDetailResponse = Omit<TourResponse, 'sessions'> & {
  sessions: TourSessionDetailResponse[]
  staffInCharge: { name: string } | null
}

export const CancellationReasonBodySchema = z.object({
  category: CancellationCategorySchema,
  freeText: z.string().optional(),
})
export type CancellationReasonBody = z.infer<typeof CancellationReasonBodySchema>

export const AdminUpdateCancellationSchema = z.object({
  unavoidable: z.boolean().nullable(),
})
export type AdminUpdateCancellation = z.infer<typeof AdminUpdateCancellationSchema>

export const AdminUpdateBookingStatusSchema = z.object({
  status: BookingStatusSchema,
})
export type AdminUpdateBookingStatus = z.infer<typeof AdminUpdateBookingStatusSchema>

export type AdminBookingStatusResponse = {
  id: string
  status: BookingStatus
}

export type CancellationReasonResponse = {
  id: string
  category: CancellationCategory
  freeText: string | null
  unavoidable: boolean | null
  recordedBy: { email: string }
  createdAt: string
}

export type CancellationSummary = {
  total: number
  unavoidable: number
  avoidable: number
  unreviewed: number
}

export const UpdateBookingBodySchema = z.object({
  status: z.enum(['confirmed', 'maybe', 'waitlist', 'declined']),
  reason: CancellationReasonBodySchema.optional(),
})
export type UpdateBookingBody = z.infer<typeof UpdateBookingBodySchema>

export type BookingResponse = {
  id: string
  tourId: string
  sessionId: string
  buddyTier: BuddyTier
  status: BookingStatus
  bookedAt: string
  updatedAt: string
}

export type AdminTourBookingEntry = {
  id: string
  buddyId: string
  sessionId: string
  sessionOrder: number
  sessionLabel: string | null
  displayName: string
  status: BookingStatus
  bookedAt: string
  cancellationReason: CancellationReasonResponse | null
}

export type AdminTourSummaryResponse = {
  id: string
  group: { id: string; name: string; type: GroupType }
  status: TourStatus
  tourDate: string
  bookingOpen: boolean
  places: PlaceSummary[]
  capacity: number
  description: string | null
  confirmedCount: number
  participantCount: number
  sessions: TourSessionResponse[]
  createdAt: string
  updatedAt: string
}

export type TourAdminAssignedAdmin = {
  adminId: string
  name: string
}

export const AssignTourAdminSchema = z.object({ adminId: z.string().uuid() })
export type AssignTourAdmin = z.infer<typeof AssignTourAdminSchema>

export const SetStaffInChargeSchema = z.object({ adminId: z.string().uuid().nullable() })
export type SetStaffInCharge = z.infer<typeof SetStaffInChargeSchema>

export type AdminTourDetailResponse = AdminTourSummaryResponse & {
  adminMemo: string | null
  cancellationDeadline: string
  maybeDeadline: string | null
  notificationOffsets: number[]
  bookings: AdminTourBookingEntry[]
  assignedAdmins: TourAdminAssignedAdmin[]
  staffInChargeId: string | null
}

export type MySessionBookingEntry = {
  bookingId: string
  sessionId: string
  sessionOrder: number
  sessionLabel: string | null
  meetingTime: string
  startTime: string | null
  endTime: string | null
  place: PlaceSummary
  bookingStatus: BookingStatus
  bookedAt: string
}

export type MyTourBookingEntry = {
  tourId: string
  tourDate: string
  places: PlaceSummary[]
  status: TourStatus
  maybeDeadline: string | null
  // Whether the caller has written a reflection on any session of this tour.
  reflectionSubmitted: boolean
  group: { name: string; type: GroupType }
  bookings: MySessionBookingEntry[]
}

// Evaluations

export const EvaluationScoreSchema = z.number().int().min(1).max(5)

const adminEvalScoreFields = {
  overallRating: EvaluationScoreSchema.nullish(),
  overallRatingNote: z.string().nullish(),
  reliability: EvaluationScoreSchema.nullish(),
  reliabilityNote: z.string().nullish(),
  communication: EvaluationScoreSchema.nullish(),
  communicationNote: z.string().nullish(),
  groupEngagement: EvaluationScoreSchema.nullish(),
  groupEngagementNote: z.string().nullish(),
  memory: EvaluationScoreSchema.nullish(),
  memoryNote: z.string().nullish(),
  knowledge: EvaluationScoreSchema.nullish(),
  knowledgeNote: z.string().nullish(),
  dedication: EvaluationScoreSchema.nullish(),
  dedicationNote: z.string().nullish(),
  dialogue: EvaluationScoreSchema.nullish(),
  dialogueNote: z.string().nullish(),
  adaptability: EvaluationScoreSchema.nullish(),
  adaptabilityNote: z.string().nullish(),
  emotionNote: z.string().nullish(),
  confidence: EvaluationScoreSchema.nullish(),
  confidenceNote: z.string().nullish(),
}

// Admin per-tour evaluation

export const CreateAdminEvaluationSchema = z.object({
  buddyId: z.string().uuid(),
  tourId: z.string().uuid(),
  absentWithoutReport: z.boolean().optional(),
  ...adminEvalScoreFields,
})
export type CreateAdminEvaluation = z.infer<typeof CreateAdminEvaluationSchema>

export const UpdateAdminEvaluationSchema = z.object({
  absentWithoutReport: z.boolean().optional(),
  ...adminEvalScoreFields,
})
export type UpdateAdminEvaluation = z.infer<typeof UpdateAdminEvaluationSchema>

// Admin profile evaluation (overall)

export const UpsertAdminProfileEvaluationSchema = z.object(adminEvalScoreFields)
export type UpsertAdminProfileEvaluation = z.infer<typeof UpsertAdminProfileEvaluationSchema>

// Evaluation response types

export type AdminEvalScores = {
  overallRating: number | null
  overallRatingNote: string | null
  reliability: number | null
  reliabilityNote: string | null
  communication: number | null
  communicationNote: string | null
  groupEngagement: number | null
  groupEngagementNote: string | null
  memory: number | null
  memoryNote: string | null
  knowledge: number | null
  knowledgeNote: string | null
  dedication: number | null
  dedicationNote: string | null
  dialogue: number | null
  dialogueNote: string | null
  adaptability: number | null
  adaptabilityNote: string | null
  emotionNote: string | null
  confidence: number | null
  confidenceNote: string | null
}

export type AdminEvaluationResponse = AdminEvalScores & {
  id: string
  buddyId: string
  buddyDisplayName: string
  tourId: string
  tourDate: string
  tourGroupName: string
  createdBy: string
  createdByName: string
  absentWithoutReport: boolean
  createdAt: string
  updatedAt: string
}

export type AdminProfileEvaluationResponse = AdminEvalScores & {
  id: string
  buddyId: string
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt: string
}

// Buddy tour reflections — four free-text prompts plus structured moments
// about a session the buddy guided, in place of the scored self-evaluation
// that used to live here (#236). `memorableMoment` was a fifth free-text
// prompt until #239 replaced it with structured TourReflectionMoment rows.

export const REFLECTION_PROMPTS = ['didWell', 'couldImprove', 'notesForOthers', 'openQuestions'] as const

export type ReflectionPrompt = (typeof REFLECTION_PROMPTS)[number]

const reflectionPromptFields = {
  didWell: z.string().nullish(),
  couldImprove: z.string().nullish(),
  notesForOthers: z.string().nullish(),
  openQuestions: z.string().nullish(),
}

// A moment is tagged to a spot of the session's place, or free text
// (`placeNote`) when the buddy picked Other, or — for a session whose place
// has no spots — the place name filled in automatically rather than chosen. Exactly one of the two is ever set (#239).
export const TourReflectionMomentSchema = z
  .object({
    spotId: z.string().uuid().nullish(),
    // Trimmed on parse, so a blank placeNote counts as unset here and is
    // stored as null, never alongside a spotId.
    placeNote: z.string().trim().nullish(),
    description: z.string().trim().min(1),
  })
  .refine((m: { spotId?: string | null; placeNote?: string | null }) => (m.spotId != null) !== Boolean(m.placeNote), {
    message: 'Exactly one of spotId or placeNote must be set',
    path: ['spotId'],
  })
export type TourReflectionMomentInput = z.infer<typeof TourReflectionMomentSchema>

// The four prompts may be blank, but not all four and no moments: nobody
// finishes a session with no thoughts at all, and an empty row would silence
// the reminder while recording nothing.
function hasAnyPrompt(value: Partial<Record<ReflectionPrompt, string | null>> & { moments?: unknown[] }): boolean {
  return REFLECTION_PROMPTS.some((key) => (value[key] ?? '').trim().length > 0) || (value.moments?.length ?? 0) > 0
}

const AT_LEAST_ONE_PROMPT = { message: 'At least one prompt or moment must be filled in' }

export const CreateTourReflectionSchema = z
  .object({
    sessionId: z.string().uuid(),
    ...reflectionPromptFields,
    moments: z.array(TourReflectionMomentSchema).default([]),
  })
  .refine(hasAnyPrompt, AT_LEAST_ONE_PROMPT)
export type CreateTourReflection = z.infer<typeof CreateTourReflectionSchema>

// A PUT replaces the four prompts and every moment, so the same rule holds on
// an edit without having to read the stored row back.
export const UpdateTourReflectionSchema = z
  .object({ ...reflectionPromptFields, moments: z.array(TourReflectionMomentSchema).default([]) })
  .refine(hasAnyPrompt, AT_LEAST_ONE_PROMPT)
export type UpdateTourReflection = z.infer<typeof UpdateTourReflectionSchema>

export type TourReflectionPrompts = Record<ReflectionPrompt, string | null>

export type TourReflectionMomentResponse = {
  id: string
  position: number
  spotId: string | null
  placeNote: string | null
  description: string
  spot: (PlaceSummary & { place: PlaceSummary }) | null
}

// `tourId`, `sessionOrder` and `sessionLabel` are read through the session
// relation — TourReflection stores none of them.
export type TourReflectionResponse = TourReflectionPrompts & {
  id: string
  buddyId: string
  sessionId: string
  sessionOrder: number
  sessionLabel: string | null
  tourId: string
  moments: TourReflectionMomentResponse[]
  createdAt: string
  updatedAt: string
  locked: boolean
}

export type AdminTourReflectionResponse = TourReflectionPrompts & {
  id: string
  buddyId: string
  buddyDisplayName: string
  sessionId: string
  sessionOrder: number
  sessionLabel: string | null
  tourId: string
  tourDate: string
  moments: TourReflectionMomentResponse[]
  createdAt: string
  updatedAt: string
}

// Admin home worklist — `GET /admin/dashboard`, PRD §11.7. Every queue is an
// actionable list linking into an existing page.
export type AdminDashboardPendingBuddy = {
  id: string
  displayName: string
  createdAt: string
}

export type AdminDashboardTourRef = {
  id: string
  tourDate: string
  group: { name: string }
}

export type AdminDashboardOverdueMaybeTour = AdminDashboardTourRef & {
  maybeDeadline: string
  maybeCount: number
}

export type AdminDashboardUnderfilledSession = {
  id: string
  order: number
  label: string | null
  minBuddies: number
  confirmedCount: number
}

export type AdminDashboardUnderfilledTour = AdminDashboardTourRef & {
  sessions: AdminDashboardUnderfilledSession[]
}

export type AdminDashboardMissingEvaluationTour = AdminDashboardTourRef & {
  missingCount: number
}

export type AdminDashboardResponse = {
  pendingBuddies: AdminDashboardPendingBuddy[]
  overdueMaybeTours: AdminDashboardOverdueMaybeTour[]
  underfilledTours: AdminDashboardUnderfilledTour[]
  underfilledLookaheadDays: number
  toursMissingEvaluations: AdminDashboardMissingEvaluationTour[]
}

// Admin buddy stats (#253, PRD §11.4)

// The scored criteria of an admin evaluation, in form order. Stats average each
// one; notes are not scored.
export const EVALUATION_SCORE_FIELDS = [
  'overallRating',
  'reliability',
  'communication',
  'groupEngagement',
  'memory',
  'knowledge',
  'dedication',
  'dialogue',
  'adaptability',
  'confidence',
] as const
export type EvaluationScoreField = (typeof EVALUATION_SCORE_FIELDS)[number]

// Every number is counted over the scope the request names (tour date range,
// group type, place). Session counts are per booking; tour counts are per tour.
// A rate or average is null when there is nothing to divide by.
export type BuddyStats = {
  sessionsAttended: number
  toursAttended: number
  noShows: number
  // Tours missed to a no-show or a late cancellation; the attendance rate's
  // other half, so the overview can pool it across buddies.
  toursMissed: number
  attendanceRate: number | null
  upcomingConfirmed: number
  openMaybe: number
  openWaitlist: number
  firstTourDate: string | null
  lastTourDate: string | null
  daysSinceLastTour: number | null
  minutesOnTour: number
  sessionsWithoutTimes: number
  bookings: number
  cancellations: number
  lateCancellations: number
  cancellationsUnavoidable: number
  cancellationsAvoidable: number
  cancellationsUnreviewed: number
  cancellationsByCategory: Record<CancellationCategory, number>
  cancellationRate: number | null
  reflections: number
  reflectionRate: number | null
  moments: number
  evaluationsReceived: number
  evaluationsMissing: number
  averageScores: Record<EvaluationScoreField, number | null>
  // How many evaluations set each criterion: the weight for averaging it
  // across buddies. A criterion can be left blank, so this is not
  // `evaluationsReceived`.
  scoreCounts: Record<EvaluationScoreField, number>
  profileOverallRating: number | null
  placesGuided: number
  sessionsByPlace: Record<string, number>
  groupTypesServed: number
  sessionsByGroupType: Record<GroupType, number>
  monthsSinceRegistration: number
}

export type AdminBuddyStatsRow = {
  id: string
  displayName: string
  realName: string
  status: BuddyStatus
  tier: BuddyTier | null
  memberType: MemberType
  createdAt: string
  stats: BuddyStats
}

export type AdminBuddyStatsResponse = {
  // Every place, for the per-place columns; `sessionsByPlace` is keyed by id.
  places: PlaceSummary[]
  buddies: AdminBuddyStatsRow[]
}

// Reflection stats — `GET /admin/reflections/stats`, PRD §11.4. A reflection
// is counted under its session's place, which a moment's spot always belongs to.
export type AdminReflectionStatsRow = AdminTourReflectionResponse & {
  buddyRealName: string
  buddyMemberType: MemberType
  group: { name: string; type: GroupType }
  place: PlaceSummary
}

// A buddy with a session attended in scope — the reflection rate's denominator,
// counted as on the buddy stats page.
export type AdminReflectionStatsBuddy = {
  id: string
  displayName: string
  realName: string
  memberType: MemberType
  sessionsAttended: number
}

export type AdminReflectionStatsPlace = PlaceSummary & {
  active: boolean
  spots: (PlaceSummary & { active: boolean })[]
}

export type AdminReflectionStatsResponse = {
  reflections: AdminReflectionStatsRow[]
  buddies: AdminReflectionStatsBuddy[]
  // Every place with every spot, in sort order, so a spot nobody wrote about
  // still shows as zero.
  places: AdminReflectionStatsPlace[]
}

// Dates

export const JST_OFFSET_MS = 9 * 60 * 60 * 1000

// Tours run in Japan, and tour and deadline dates are Japanese calendar dates
// (`@db.Date`), so "today" is the date there, as `YYYY-MM-DD`. It is never the UTC
// date, the viewer's device or the server's clock. Japan has no daylight saving,
// so a fixed offset is exact. See docs/decisions.md.
export function getTodayJst(now: Date = new Date()): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10)
}

// The same day as a UTC-midnight Date: the shape Prisma returns for a `@db.Date`
// column, for comparing against those values in queries.
export function jstStartOfDayUtc(now: Date = new Date()): Date {
  return new Date(`${getTodayJst(now)}T00:00:00.000Z`)
}
