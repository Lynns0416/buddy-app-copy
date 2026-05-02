import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '@/lib/action'
import { classifyApiError } from '@/lib/api-error'
import type {
  SelfEvaluationResponse,
  CreateSelfEvaluation,
  UpdateSelfEvaluation,
} from '@peace-buddy/types'

export async function listMySelfEvaluations(
  params: { tourId?: string } = {},
): Promise<ActionResult<SelfEvaluationResponse[]>> {
  try {
    return { ok: true, data: await apiClient.listMySelfEvaluations(params) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function createSelfEvaluation(
  data: CreateSelfEvaluation,
): Promise<ActionResult<SelfEvaluationResponse>> {
  try {
    return { ok: true, data: await apiClient.createSelfEvaluation(data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateSelfEvaluation(
  id: string,
  data: UpdateSelfEvaluation,
): Promise<ActionResult<SelfEvaluationResponse>> {
  try {
    return { ok: true, data: await apiClient.updateSelfEvaluation(id, data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
