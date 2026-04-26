import type { GroupResponse, GroupDetailResponse, CreateGroup, UpdateGroup, AppError } from '@peace-buddy/types'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import type { SortDir } from '@/components/sort-icon'
import { routing } from '@/i18n/routing'
import { apiClient } from '@/lib/api-client'
import { ApiError } from '@/lib/api'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: AppError }

export type GroupSortField = 'name' | 'type'
export type GroupTourSortField = 'tourDate' | 'status' | 'location' | 'capacity'

const ASC: SortDir = 'asc'
const DESC: SortDir = 'desc'

function classifyApiError(err: unknown): AppError {
  if (err instanceof ApiError) {
    if (err.status === 404) return { code: AppErrorCodeSchema.enum.not_found }
    if (err.status === 403) return { code: AppErrorCodeSchema.enum.forbidden }
    if (err.status === 409) return { code: AppErrorCodeSchema.enum.conflict }
    return { code: AppErrorCodeSchema.enum.unknown }
  }
  return { code: AppErrorCodeSchema.enum.network }
}

export function sortGroups(
  groups: GroupResponse[],
  field: GroupSortField,
  dir: SortDir,
): GroupResponse[] {
  return [...groups].sort((a, b) => {
    const cmp = a[field].localeCompare(b[field], routing.defaultLocale)
    return dir === ASC ? cmp : -cmp
  })
}

export function nextGroupSort(
  current: { field: GroupSortField; dir: SortDir },
  clicked: GroupSortField,
): { field: GroupSortField; dir: SortDir } {
  if (clicked === current.field) {
    return { field: current.field, dir: current.dir === ASC ? DESC : ASC }
  }
  return { field: clicked, dir: ASC }
}

export function sortGroupTours(
  tours: GroupDetailResponse['tours'],
  field: GroupTourSortField,
  dir: SortDir,
): GroupDetailResponse['tours'] {
  return [...tours].sort((a, b) => {
    let cmp = 0
    switch (field) {
      case 'tourDate':  cmp = a.tourDate.localeCompare(b.tourDate); break
      case 'status':    cmp = a.status.localeCompare(b.status); break
      case 'location':  cmp = a.location.localeCompare(b.location, routing.defaultLocale); break
      case 'capacity':  cmp = a.capacity - b.capacity; break
    }
    return dir === ASC ? cmp : -cmp
  })
}

export function nextGroupTourSort(
  current: { field: GroupTourSortField; dir: SortDir },
  clicked: GroupTourSortField,
): { field: GroupTourSortField; dir: SortDir } {
  if (clicked === current.field) {
    return { field: current.field, dir: current.dir === ASC ? DESC : ASC }
  }
  return { field: clicked, dir: ASC }
}

export async function fetchGroups(): Promise<ActionResult<GroupResponse[]>> {
  try {
    return { ok: true, data: await apiClient.listGroups() }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function fetchGroup(id: string): Promise<ActionResult<GroupDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.getGroup(id) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function createGroup(data: CreateGroup): Promise<ActionResult<GroupResponse>> {
  try {
    return { ok: true, data: await apiClient.createGroup(data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateGroup(id: string, data: UpdateGroup): Promise<ActionResult<GroupResponse>> {
  try {
    return { ok: true, data: await apiClient.updateGroup(id, data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
