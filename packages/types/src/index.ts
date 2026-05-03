import { z } from 'zod'

// Enums

export const UserRoleSchema = z.enum(['buddy', 'admin', 'super_admin'])
export type UserRole = z.infer<typeof UserRoleSchema>

export const BuddyStatusSchema = z.enum(['pending', 'active', 'rejected', 'suspended'])
export type BuddyStatus = z.infer<typeof BuddyStatusSchema>

export const BuddyTierSchema = z.enum(['trainee', 'junior', 'mid', 'senior', 'expert', 'instructor', 'organizer'])
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
])
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

// `network` is client-only and is never emitted by the server
export const AppErrorCodeSchema = z.enum(['not_found', 'forbidden', 'conflict', 'invalid_request', 'network', 'unknown'])
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
    (d) => !d.languages || d.languages.length === new Set(d.languages).size,
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
    availability: z.string().nullable().optional(),
  })
  .refine(
    (d) => !d.languages || d.languages.length === new Set(d.languages).size,
    { message: 'Duplicate languages are not allowed', path: ['languages'] }
  )
export type UpdateBuddyProfile = z.infer<typeof UpdateBuddyProfileSchema>

// Tour (admin)

const timeRegex = /^\d{2}:\d{2}$/

export const CreateTourSchema = z
  .object({
    groupId: z.string().uuid(),
    tourDate: z.coerce.date(),
    meetingTime: z.string().regex(timeRegex),
    startTime: z.string().regex(timeRegex).optional(),
    endTime: z.string().regex(timeRegex).optional(),
    bookingOpen: z.boolean().default(false),
    location: z.string().min(1),
    capacity: z.number().int().positive(),
    participantCount: z.number().int().min(0).optional(),
    description: z.string().optional(),
    adminMemo: z.string().optional(),
    cancellationDeadline: z.coerce.date(),
    maybeDeadline: z.coerce.date().optional(),
    notificationOffsets: z.array(z.number().int().min(0)).default([3, 1]),
  })
  .refine((d) => !d.maybeDeadline || d.maybeDeadline < d.cancellationDeadline, {
    message: 'maybeDeadline must be before cancellationDeadline',
    path: ['maybeDeadline'],
  })
export type CreateTour = z.infer<typeof CreateTourSchema>

export const UpdateTourSchema = z
  .object({
    groupId: z.string().uuid().optional(),
    tourDate: z.coerce.date().optional(),
    meetingTime: z.string().regex(timeRegex).optional(),
    startTime: z.string().regex(timeRegex).nullable().optional(),
    endTime: z.string().regex(timeRegex).nullable().optional(),
    bookingOpen: z.boolean().optional(),
    location: z.string().min(1).optional(),
    capacity: z.number().int().positive().optional(),
    participantCount: z.number().int().min(0).optional(),
    description: z.string().nullable().optional(),
    adminMemo: z.string().nullable().optional(),
    cancellationDeadline: z.coerce.date().optional(),
    maybeDeadline: z.coerce.date().nullable().optional(),
    notificationOffsets: z.array(z.number().int().min(0)).optional(),
  })
  .refine(
    (d) => {
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
  z.object({ status: z.literal('active'), tier: BuddyTierSchema.optional() }),
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
  availability: string | null
  createdAt: string
  updatedAt: string
}

export type TourResponse = {
  id: string
  groupId: string
  group: { id: string; name: string; type: GroupType }
  status: TourStatus
  tourDate: string
  meetingTime: string
  startTime: string | null
  endTime: string | null
  bookingOpen: boolean
  location: string
  capacity: number
  participantCount: number
  description: string | null
  cancellationDeadline: string
  maybeDeadline: string | null
  notificationOffsets: number[]
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
  meetingTime: string
  startTime: string | null
  endTime: string | null
  bookingOpen: boolean
  location: string
  capacity: number
  participantCount: number
  description: string | null
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
  email: string
  internalNotes: string | null
  createdAt: string
  updatedAt: string
}

export type AdminBuddyBookingEntry = {
  id: string
  tourId: string
  status: BookingStatus
  bookedAt: string
  tour: {
    tourDate: string
    location: string
    group: { name: string }
    status: TourStatus
  }
}

export type AdminBuddyDetailResponse = AdminBuddyResponse & {
  bookings: AdminBuddyBookingEntry[]
}

// Sanitized response — no admin-only fields
export type UserResponse = {
  id: string
  email: string
  role: UserRole
  createdAt: string
  buddyProfile: BuddyProfileResponse | null
}

export type TourSeatCounts = {
  confirmed: number
  maybe: number
  waitlist: number
  declined: number
}

export type TourDetailResponse = TourResponse & {
  seatCounts: TourSeatCounts
  remainingSeats: number
  myBookingStatus: BookingStatus | null
}

export const CancellationReasonBodySchema = z.object({
  category: CancellationCategorySchema,
  freeText: z.string().optional(),
  unavoidable: z.boolean(),
})
export type CancellationReasonBody = z.infer<typeof CancellationReasonBodySchema>

export const CreateBookingBodySchema = z.object({
  initialStatus: z.enum(['confirmed', 'maybe', 'declined']).optional(),
})
export type CreateBookingBody = z.infer<typeof CreateBookingBodySchema>

export const UpdateBookingBodySchema = z.object({
  status: z.enum(['confirmed', 'maybe', 'waitlist', 'declined']),
  reason: CancellationReasonBodySchema.optional(),
})
export type UpdateBookingBody = z.infer<typeof UpdateBookingBodySchema>

export type BookingResponse = {
  id: string
  tourId: string
  status: BookingStatus
  bookedAt: string
  updatedAt: string
}

export type AdminTourBookingEntry = {
  id: string
  buddyId: string
  displayName: string
  status: BookingStatus
  bookedAt: string
}

export type AdminTourSummaryResponse = {
  id: string
  group: { id: string; name: string; type: GroupType }
  status: TourStatus
  tourDate: string
  meetingTime: string
  startTime: string | null
  endTime: string | null
  bookingOpen: boolean
  location: string
  capacity: number
  description: string | null
  confirmedCount: number
  participantCount: number
  createdAt: string
  updatedAt: string
}

export type AdminTourDetailResponse = AdminTourSummaryResponse & {
  adminMemo: string | null
  cancellationDeadline: string
  maybeDeadline: string | null
  notificationOffsets: number[]
  bookings: AdminTourBookingEntry[]
}

export type MyBookingEntry = {
  id: string
  tourId: string
  status: BookingStatus
  bookedAt: string
  updatedAt: string
  tour: {
    tourDate: string
    meetingTime: string
    location: string
    group: { name: string }
    status: TourStatus
  }
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
  ...adminEvalScoreFields,
})
export type CreateAdminEvaluation = z.infer<typeof CreateAdminEvaluationSchema>

export const UpdateAdminEvaluationSchema = z.object(adminEvalScoreFields)
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

type AdminEvalScores = {
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
  createdByEmail: string
  createdAt: string
  updatedAt: string
}

export type AdminProfileEvaluationResponse = AdminEvalScores & {
  id: string
  buddyId: string
  createdBy: string
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
