import type { BuddyProfileResponse, UpdateBuddyProfile } from '@peace-buddy/types'
import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '../../../../lib/action'
import { classifyApiError } from '../../../../lib/api-error'

export async function fetchMyProfile(): Promise<ActionResult<BuddyProfileResponse>> {
  try {
    return { ok: true, data: await apiClient.getMyProfile() }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateMyProfile(data: UpdateBuddyProfile): Promise<ActionResult<BuddyProfileResponse>> {
  try {
    return { ok: true, data: await apiClient.updateMyProfile(data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
