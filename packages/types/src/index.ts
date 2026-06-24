import { z } from 'zod'

// Enums

export const UserRoleSchema = z.enum(['buddy', 'admin', 'super_admin'])
export type UserRole = z.infer<typeof UserRoleSchema>

export const BuddyStatusSchema = z.enum(['pending', 'trainee', 'active', 'rejected', 'suspended'])
export type BuddyStatus = z.infer<typeof BuddyStatusSchema>

export const BuddyTierSchema = z.enum(['junior', 'mid', 'senior', 'expert', 'instructor', 'organizer'] as const)
export type BuddyTier = z.infer<typeof BuddyTierSchema>

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

export const NotifEventTypeSchema = z.enum([
  'new_signup',
  'new_booking',
  'cancellation',
  'maybe_resolved',
  'maybe_deadline_missed',
])
export type NotifEventType = z.infer<typeof NotifEventTypeSchema>

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
    photoUrl: z.string().optional(),
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
    photoUrl: z.string().nullable().optional(),
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
    location: z.string().min(1),
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
    location: z.string().min(1).optional(),
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

// Admin

export const UpdateBuddyStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('trainee') }),
  z.object({ status: z.literal('active') }),
  z.object({ status: z.literal('rejected') }),
])
export type UpdateBuddyStatus = z.infer<typeof UpdateBuddyStatusSchema>

export const UpdateAdminBuddyProfileSchema = z.object({
  tier: BuddyTierSchema.nullable().optional(),
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
  displayName: string
  realName: string
  photoUrl: string | null
  bio: string | null
  contactInfo: string | null
  languages: Language[]
  skills: string[]
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
}

export type TourResponse = {
  id: string
  groupId: string
  group: { id: string; name: string; type: GroupType }
  status: TourStatus
  tourDate: string
  bookingOpen: boolean
  location: string
  participantCount: number
  description: string | null
  cancellationDeadline: string
  maybeDeadline: string | null
  notificationOffsets: number[]
  sessions: TourSessionResponse[]
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
  location: string
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
    location: string
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

export type TourSessionDetailResponse = TourSessionResponse & {
  seatCounts: TourSeatCounts
  remaining: number
  myCapacity: number | null
  myRemaining: number | null
  myBookingStatus: BookingStatus | null
}

export type TourDetailResponse = Omit<TourResponse, 'sessions'> & {
  sessions: TourSessionDetailResponse[]
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
  location: string
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
  bookingStatus: BookingStatus
  bookedAt: string
}

export type MyTourBookingEntry = {
  tourId: string
  tourDate: string
  location: string
  status: TourStatus
  group: { name: string }
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

const selfEvalScoreFields = {
  overallRating: adminEvalScoreFields.overallRating,
  overallRatingNote: adminEvalScoreFields.overallRatingNote,
  communication: adminEvalScoreFields.communication,
  communicationNote: adminEvalScoreFields.communicationNote,
  groupEngagement: adminEvalScoreFields.groupEngagement,
  groupEngagementNote: adminEvalScoreFields.groupEngagementNote,
  memory: adminEvalScoreFields.memory,
  memoryNote: adminEvalScoreFields.memoryNote,
  knowledge: adminEvalScoreFields.knowledge,
  knowledgeNote: adminEvalScoreFields.knowledgeNote,
  dedication: adminEvalScoreFields.dedication,
  dedicationNote: adminEvalScoreFields.dedicationNote,
  dialogue: adminEvalScoreFields.dialogue,
  dialogueNote: adminEvalScoreFields.dialogueNote,
  adaptability: adminEvalScoreFields.adaptability,
  adaptabilityNote: adminEvalScoreFields.adaptabilityNote,
  emotionNote: adminEvalScoreFields.emotionNote,
  confidence: adminEvalScoreFields.confidence,
  confidenceNote: adminEvalScoreFields.confidenceNote,
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

// Buddy self-evaluation

export const CreateSelfEvaluationSchema = z.object({
  tourId: z.string().uuid(),
  ...selfEvalScoreFields,
})
export type CreateSelfEvaluation = z.infer<typeof CreateSelfEvaluationSchema>

export const UpdateSelfEvaluationSchema = z.object(selfEvalScoreFields)
export type UpdateSelfEvaluation = z.infer<typeof UpdateSelfEvaluationSchema>

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

type SelfEvalScores = Omit<AdminEvalScores, 'reliability' | 'reliabilityNote'>

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

export type SelfEvaluationResponse = SelfEvalScores & {
  id: string
  buddyId: string
  tourId: string
  createdAt: string
  updatedAt: string
  locked: boolean
}

export type AdminSelfEvaluationResponse = SelfEvalScores & {
  id: string
  buddyId: string
  buddyDisplayName: string
  tourId: string
  createdAt: string
  updatedAt: string
}
