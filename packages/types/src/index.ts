import { z } from 'zod'

// Enums

export const UserRoleSchema = z.enum(['buddy', 'admin', 'super_admin'])
export type UserRole = z.infer<typeof UserRoleSchema>

export const BuddyStatusSchema = z.enum(['pending', 'trainee', 'active', 'rejected', 'suspended'])
export type BuddyStatus = z.infer<typeof BuddyStatusSchema>

export const BuddyTierSchema = z.enum(['junior', 'mid', 'senior', 'expert', 'instructor', 'organizer'])
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
