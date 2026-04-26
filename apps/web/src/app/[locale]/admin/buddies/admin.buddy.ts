import type { AdminBuddyResponse, BuddyStatus } from '@peace-buddy/types'
import type { SortDir } from '@/components/sort-icon'
import { routing } from '@/i18n/routing'
import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '../../../../lib/action'
import { classifyApiError } from '../../../../lib/api-error'
import { ASC, DESC } from '../../../../lib/constants'

export type BuddySortField = 'displayName' | 'email'

export function sortBuddies(
  buddies: AdminBuddyResponse[],
  field: BuddySortField,
  dir: SortDir,
): AdminBuddyResponse[] {
  return [...buddies].sort((a, b) => {
    const cmp = field === 'displayName'
      ? a.displayName.localeCompare(b.displayName, routing.defaultLocale)
      : a.email.localeCompare(b.email)
    return dir === ASC ? cmp : -cmp
  })
}

export function nextBuddySort(
  current: { field: BuddySortField; dir: SortDir },
  clicked: BuddySortField,
): { field: BuddySortField; dir: SortDir } {
  if (clicked === current.field) {
    return { field: current.field, dir: current.dir === ASC ? DESC : ASC }
  }
  return { field: clicked, dir: ASC }
}

export async function fetchBuddies(status: BuddyStatus): Promise<ActionResult<AdminBuddyResponse[]>> {
  try {
    return { ok: true, data: await apiClient.listBuddies(status) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateBuddyStatus(id: string, status: BuddyStatus): Promise<ActionResult<void>> {
  try {
    await apiClient.updateBuddyStatus(id, { status })
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
