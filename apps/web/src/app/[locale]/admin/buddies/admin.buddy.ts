import type { AdminBuddyResponse, AdminBuddyDetailResponse, AdminBuddyBookingEntry, BuddyStatus, BuddyTier, UpdateAdminBuddyProfile, AppError } from '@peace-buddy/types'
import { AppErrorCodeSchema, BuddyStatusSchema } from '@peace-buddy/types'
import type { SortDir } from '@/components/sort-icon'
import { routing } from '@/i18n/routing'
import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '../../../../lib/action'
import { classifyApiError } from '../../../../lib/api-error'
import { ASC, DESC } from '../../../../lib/constants'

export type BuddySortField = 'displayName' | 'email' | 'tier'

export function mapBuddyError(t: (key: string) => string, error: AppError): string {
  switch (error.code) {
    case AppErrorCodeSchema.enum.not_found:  return t('error.notFound')
    case AppErrorCodeSchema.enum.forbidden:  return t('error.forbidden')
    case AppErrorCodeSchema.enum.conflict:   return t('error.conflict')
    case AppErrorCodeSchema.enum.network:    return t('error.network')
    default:                                 return t('error.unknown')
  }
}

export function sortBuddies(
  buddies: AdminBuddyResponse[],
  field: BuddySortField,
  dir: SortDir,
): AdminBuddyResponse[] {
  return [...buddies].sort((a, b) => {
    let cmp = 0
    if (field === 'displayName') {
      cmp = a.displayName.localeCompare(b.displayName, routing.defaultLocale)
    } else if (field === 'email') {
      cmp = a.email.localeCompare(b.email)
    } else if (field === 'tier') {
      const aTier = a.tier || ''
      const bTier = b.tier || ''
      cmp = aTier.localeCompare(bTier)
    }
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

export async function fetchBuddies(status: BuddyStatus, tier?: BuddyTier): Promise<ActionResult<AdminBuddyResponse[]>> {
  try {
    return { ok: true, data: await apiClient.listBuddies(status, tier) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function fetchTrainees(): Promise<ActionResult<AdminBuddyResponse[]>> {
  return fetchBuddies(BuddyStatusSchema.enum.trainee)
}

export async function updateBuddyStatus(id: string, status: BuddyStatus): Promise<ActionResult<void>> {
  try {
    await apiClient.updateBuddyStatus(id, { status })
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export type BookingHistorySortField = 'group' | 'tourDate' | 'status'

export function sortBookingHistory(
  bookings: AdminBuddyBookingEntry[],
  field: BookingHistorySortField,
  dir: SortDir,
): AdminBuddyBookingEntry[] {
  return [...bookings].sort((a, b) => {
    let cmp = 0
    if (field === 'group') {
      cmp = a.tour.group.name.localeCompare(b.tour.group.name)
    } else if (field === 'tourDate') {
      cmp = a.tour.tourDate.localeCompare(b.tour.tourDate)
    } else if (field === 'status') {
      cmp = a.status.localeCompare(b.status)
    }
    return dir === ASC ? cmp : -cmp
  })
}

export function nextBookingSort(
  current: { field: BookingHistorySortField; dir: SortDir },
  clicked: BookingHistorySortField,
): { field: BookingHistorySortField; dir: SortDir } {
  if (clicked === current.field) {
    return { field: current.field, dir: current.dir === ASC ? DESC : ASC }
  }
  return { field: clicked, dir: ASC }
}

export async function fetchBuddy(id: string): Promise<ActionResult<AdminBuddyDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.getBuddy(id) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateBuddy(id: string, data: UpdateAdminBuddyProfile): Promise<ActionResult<AdminBuddyResponse>> {
  try {
    return { ok: true, data: await apiClient.updateBuddy(id, data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
