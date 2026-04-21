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

// Auth

export const RegisterRequestBodySchema = z.object({
  displayName: z.string().optional(),
  realName: z.string().optional(),
  languages: z.array(z.string()).optional(),
  photoUrl: z.string().optional(),
  bio: z.string().optional(),
})
export type RegisterRequestBody = z.infer<typeof RegisterRequestBodySchema>

// Buddy Profile

export const UpdateBuddyProfileSchema = z.object({
  displayName: z.string().optional(),
  realName: z.string().optional(),
  photoUrl: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  contactInfo: z.string().nullable().optional(),
  languages: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  availability: z.string().nullable().optional(),
})
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

// Response types (HTTP wire format — dates serialized as ISO strings)

export type BuddyProfileResponse = {
  id: string
  status: BuddyStatus
  displayName: string
  realName: string
  photoUrl: string | null
  bio: string | null
  contactInfo: string | null
  languages: string[]
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

export const UpdateBookingBodySchema = z.object({
  status: z.enum(['confirmed', 'maybe', 'declined']),
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
