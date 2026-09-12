import type { BuddyStatus, BuddyTier, TourStatus, BookingStatus, GroupType } from '@peace-buddy/types'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'
type TFn = (key: string) => string

export function getBuddyStatusLabel(t: TFn, status: BuddyStatus): string {
  return t(status)
}

export function getBuddyTierLabel(t: TFn, tier: BuddyTier): string {
  return t(tier)
}

export function getTourStatusLabel(t: TFn, status: TourStatus): string {
  return t(status)
}

export function getBookingStatusLabel(t: TFn, status: BookingStatus): string {
  return t(status)
}

export function getGroupTypeLabel(t: TFn, type: GroupType): string {
  return t(type)
}

export const buddyStatusBadgeVariant: Record<BuddyStatus, BadgeVariant> = {
  pending: 'secondary',
  trainee: 'secondary',
  active: 'default',
  rejected: 'destructive',
  suspended: 'outline',
}

export const tourStatusBadgeVariant: Record<TourStatus, BadgeVariant> = {
  draft: 'outline',
  published: 'default',
  cancelled: 'destructive',
  completed: 'secondary',
}

export const bookingStatusBadgeVariant: Record<BookingStatus, BadgeVariant> = {
  confirmed: 'default',
  maybe: 'secondary',
  waitlist: 'outline',
  declined: 'destructive',
}

export const groupTypeBadgeClass: Record<GroupType, string> = {
  school: 'bg-blue-100 text-blue-800 border-blue-200',
  company: 'bg-amber-100 text-amber-800 border-amber-200',
  community: 'bg-green-100 text-green-800 border-green-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
}
