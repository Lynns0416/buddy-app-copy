import type { UpdateBookingBody, CancellationReasonBody, AppErrorCode } from '@peace-buddy/types'
import type { BookingStatusSchema } from '@peace-buddy/types'
import { apiClient } from '@/lib/api-client'
import { ApiError } from '@/lib/api'
import type { ActionResult } from '../../../../../lib/action'
import { classifyApiError } from '../../../../../lib/api-error'

export type BookingActionResult = ActionResult<void> & { specialMessage?: string }

export async function createInitialBooking(
  tourId: string,
  sessionId: string,
  status?: typeof BookingStatusSchema.enum.maybe,
): Promise<BookingActionResult> {
  try {
    await apiClient.createBooking(tourId, sessionId, status)
    return { ok: true, data: undefined }
  } catch (err) {
    return toBookingError(err)
  }
}

export async function updateBookingStatus(
  tourId: string,
  sessionId: string,
  status: string,
  reason?: CancellationReasonBody,
): Promise<BookingActionResult> {
  try {
    const body: UpdateBookingBody = { status: status as UpdateBookingBody['status'] }
    if (reason) {
      body.reason = reason
    }
    await apiClient.updateBooking(tourId, sessionId, body.status, body.reason)
    return { ok: true, data: undefined }
  } catch (err) {
    return toBookingError(err)
  }
}

function toBookingError(err: unknown): BookingActionResult {
  const result: BookingActionResult = { ok: false, error: classifyApiError(err) }
  if (err instanceof ApiError && err.message === 'Maybe deadline has passed') {
    result.specialMessage = 'maybeDeadlinePassed'
  }
  return result
}

export async function reportCantGo(
  tourId: string,
  sessionId: string,
  data: CancellationReasonBody,
): Promise<BookingActionResult> {
  try {
    await apiClient.reportCantGo(tourId, sessionId, data)
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export function mapErrorToI18nKey(code: AppErrorCode): string {
  switch (code) {
    case 'conflict':
      return 'tourFull'
    case 'invalid_request':
      return 'deadlinePassed'
    case 'forbidden':
      return 'notEligible'
    default:
      return 'bookingError'
  }
}
