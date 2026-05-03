import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '@/lib/action'
import { classifyApiError } from '@/lib/api-error'
import { ApiError } from '@/lib/api'
import type { AdminProfileResponse } from '@peace-buddy/types'

export async function getMyAdminProfile(): Promise<ActionResult<AdminProfileResponse | null>> {
  try {
    return { ok: true, data: await apiClient.getAdminProfile() }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { ok: true, data: null }
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateMyAdminProfile(name: string): Promise<ActionResult<AdminProfileResponse>> {
  try {
    return { ok: true, data: await apiClient.updateAdminProfile(name) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
