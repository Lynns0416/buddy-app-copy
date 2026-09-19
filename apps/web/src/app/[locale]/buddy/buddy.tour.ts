import type { TourResponse } from '@peace-buddy/types'
import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '../../../lib/action'
import { classifyApiError } from '../../../lib/api-error'

export async function fetchUpcomingTours(fromDate: string): Promise<ActionResult<TourResponse[]>> {
  try {
    return { ok: true, data: await apiClient.listTours(fromDate) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function downloadTourCalendar(id: string): Promise<ActionResult<Blob>> {
  try {
    return { ok: true, data: await apiClient.downloadTourCalendar(id) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
