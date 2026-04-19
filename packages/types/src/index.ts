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
  location: string
  capacity: number
  description: string | null
  cancellationDeadline: string
  maybeDeadline: string | null
  notificationOffsets: number[]
  createdAt: string
  updatedAt: string
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
