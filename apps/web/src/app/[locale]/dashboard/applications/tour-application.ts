import { apiClient } from '@/lib/api-client'
import { classifyApiError } from '@/lib/api-error'
import type { ActionResult } from '@/lib/action'
import type { ApplicationResponse } from '@peace-buddy/types'

export async function getApplicationStatus(tourId: string): Promise<ActionResult<ApplicationResponse | null>> {
  try {
    return { ok: true, data: await apiClient.getApplicationStatus(tourId) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function createApplication(tourId: string): Promise<ActionResult<ApplicationResponse>> {
  try {
    return { ok: true, data: await apiClient.createApplication(tourId) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function cancelApplication(id: string): Promise<ActionResult<void>> {
  try {
    await apiClient.cancelApplication(id)
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
