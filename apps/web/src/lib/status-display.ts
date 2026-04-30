import type { BuddyStatus, TourStatus, BookingStatus } from '@peace-buddy/types'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'
type TFn = (key: string) => string

// Each function takes a t from useTranslations('buddyStatus'/'tourStatus'/'bookingStatus')
export function getBuddyStatusLabel(t: TFn, status: BuddyStatus): string {
  return t(status)
}

export function getTourStatusLabel(t: TFn, status: TourStatus): string {
  return t(status)
}

export function getBookingStatusLabel(t: TFn, status: BookingStatus): string {
  return t(status)
}

export const buddyStatusBadgeVariant: Record<BuddyStatus, BadgeVariant> = {
  active: 'default',
  pending: 'secondary',
  suspended: 'outline',
  rejected: 'destructive',
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

// TODO §5.1: add 'trainee' BuddyStatus — schema + admin transitions + dashboard gating (phase 2)
