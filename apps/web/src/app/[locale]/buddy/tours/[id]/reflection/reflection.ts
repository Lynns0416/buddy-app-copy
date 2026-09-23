import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '@/lib/action'
import { classifyApiError } from '@/lib/api-error'
import type {
  TourReflectionResponse,
  CreateTourReflection,
  UpdateTourReflection,
} from '@peace-buddy/types'

export async function listMyReflections(
  params: { tourId?: string } = {},
): Promise<ActionResult<TourReflectionResponse[]>> {
  try {
    return { ok: true, data: await apiClient.listMyReflections(params) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function createReflection(
  data: CreateTourReflection,
): Promise<ActionResult<TourReflectionResponse>> {
  try {
    return { ok: true, data: await apiClient.createReflection(data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateReflection(
  id: string,
  data: UpdateTourReflection,
): Promise<ActionResult<TourReflectionResponse>> {
  try {
    return { ok: true, data: await apiClient.updateReflection(id, data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
