import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '@/lib/action'
import { classifyApiError } from '@/lib/api-error'
import type { AdminProfileResponse } from '@peace-buddy/types'
import type { SortDir } from '@/components/sort-icon'
import { ASC, DESC } from '@/lib/constants'

export type AdminProfileSortField = 'name' | 'createdAt'

export function sortAdminProfiles(
  profiles: AdminProfileResponse[],
  field: AdminProfileSortField,
  dir: SortDir,
): AdminProfileResponse[] {
  return [...profiles].sort((a, b) => {
    const cmp = field === 'name'
      ? a.name.localeCompare(b.name)
      : a.createdAt.localeCompare(b.createdAt)
    return dir === ASC ? cmp : -cmp
  })
}

export function nextAdminProfileSort(
  current: { field: AdminProfileSortField; dir: SortDir },
  clicked: AdminProfileSortField,
): { field: AdminProfileSortField; dir: SortDir } {
  if (clicked === current.field) {
    return { field: current.field, dir: current.dir === ASC ? DESC : ASC }
  }
  return { field: clicked, dir: ASC }
}

export async function listAdminProfiles(): Promise<ActionResult<AdminProfileResponse[]>> {
  try {
    return { ok: true, data: await apiClient.listAdminProfiles() }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function softDeleteAdminProfile(userId: string): Promise<ActionResult<AdminProfileResponse>> {
  try {
    return { ok: true, data: await apiClient.softDeleteAdminProfile(userId) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
