import type { PlaceResponse, PlaceDetailResponse, SpotResponse, CreatePlace, UpdatePlace, CreateSpot, UpdateSpot } from '@peace-buddy/types'
import type { SortDir } from '@/components/sort-icon'
import { routing } from '@/i18n/routing'
import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '../../../../lib/action'
import { classifyApiError } from '../../../../lib/api-error'
import { ASC, DESC } from '../../../../lib/constants'

export type PlaceSortField = 'nameJa' | 'nameEn' | 'sortOrder' | 'active'

export function sortPlaces<T extends { nameJa: string; nameEn: string; sortOrder: number; active: boolean }>(
  rows: T[],
  field: PlaceSortField,
  dir: SortDir,
): T[] {
  return [...rows].sort((a, b) => {
    let cmp = 0
    switch (field) {
      case 'nameJa':    cmp = a.nameJa.localeCompare(b.nameJa, routing.defaultLocale); break
      case 'nameEn':    cmp = a.nameEn.localeCompare(b.nameEn, routing.defaultLocale); break
      case 'sortOrder': cmp = a.sortOrder - b.sortOrder; break
      case 'active':    cmp = Number(a.active) - Number(b.active); break
    }
    return dir === ASC ? cmp : -cmp
  })
}

export function nextPlaceSort(
  current: { field: PlaceSortField; dir: SortDir },
  clicked: PlaceSortField,
): { field: PlaceSortField; dir: SortDir } {
  if (clicked === current.field) {
    return { field: current.field, dir: current.dir === ASC ? DESC : ASC }
  }
  return { field: clicked, dir: ASC }
}

export async function fetchPlaces(): Promise<ActionResult<PlaceResponse[]>> {
  try {
    return { ok: true, data: await apiClient.listPlaces() }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function fetchPlace(id: string): Promise<ActionResult<PlaceDetailResponse>> {
  try {
    return { ok: true, data: await apiClient.getPlace(id) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function createPlace(data: CreatePlace): Promise<ActionResult<PlaceResponse>> {
  try {
    return { ok: true, data: await apiClient.createPlace(data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updatePlace(id: string, data: UpdatePlace): Promise<ActionResult<PlaceResponse>> {
  try {
    return { ok: true, data: await apiClient.updatePlace(id, data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function createSpot(placeId: string, data: CreateSpot): Promise<ActionResult<SpotResponse>> {
  try {
    return { ok: true, data: await apiClient.createSpot(placeId, data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateSpot(placeId: string, spotId: string, data: UpdateSpot): Promise<ActionResult<SpotResponse>> {
  try {
    return { ok: true, data: await apiClient.updateSpot(placeId, spotId, data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
