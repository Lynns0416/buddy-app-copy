import type { TourStatus } from '@peace-buddy/types'
import { TourStatusSchema } from '@peace-buddy/types'

export function isPastDeadline(todayStr: string, deadlineStr: string): boolean {
  return todayStr >= deadlineStr.slice(0, 10)
}

export function canSelectMaybeStatus(isPastMaybe: boolean, isPastCancellation: boolean): boolean {
  return !isPastMaybe && !isPastCancellation
}

export function isBookingAllowed(tourStatus: TourStatus, bookingOpen: boolean, tourDate: string): boolean {
  return (
    tourStatus === TourStatusSchema.enum.published &&
    bookingOpen &&
    new Date(tourDate) > new Date()
  )
}
