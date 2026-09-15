import type { AdminDashboardResponse } from '@peace-buddy/types'
import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '@/lib/action'
import { classifyApiError } from '@/lib/api-error'

export async function fetchAdminDashboard(): Promise<ActionResult<AdminDashboardResponse>> {
  try {
    return { ok: true, data: await apiClient.getAdminDashboard() }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
