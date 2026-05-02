import { apiClient } from '@/lib/api-client'
import type { ActionResult } from '@/lib/action'
import { classifyApiError } from '@/lib/api-error'
import type {
  AdminEvaluationResponse,
  CreateAdminEvaluation,
  UpdateAdminEvaluation,
  AdminProfileEvaluationResponse,
  UpsertAdminProfileEvaluation,
  AdminSelfEvaluationResponse,
} from '@peace-buddy/types'
import { ApiError } from '@/lib/api'

export async function listAdminEvaluations(
  params: { buddyId?: string; tourId?: string },
): Promise<ActionResult<AdminEvaluationResponse[]>> {
  try {
    return { ok: true, data: await apiClient.listAdminEvaluations(params) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function getAdminEvaluation(
  id: string,
): Promise<ActionResult<AdminEvaluationResponse | null>> {
  try {
    return { ok: true, data: await apiClient.getAdminEvaluation(id) }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { ok: true, data: null }
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function createAdminEvaluation(
  data: CreateAdminEvaluation,
): Promise<ActionResult<AdminEvaluationResponse>> {
  try {
    return { ok: true, data: await apiClient.createAdminEvaluation(data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function updateAdminEvaluation(
  id: string,
  data: UpdateAdminEvaluation,
): Promise<ActionResult<AdminEvaluationResponse>> {
  try {
    return { ok: true, data: await apiClient.updateAdminEvaluation(id, data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function deleteAdminEvaluation(id: string): Promise<ActionResult<void>> {
  try {
    await apiClient.deleteAdminEvaluation(id)
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function getAdminProfileEvaluation(
  buddyId: string,
): Promise<ActionResult<AdminProfileEvaluationResponse | null>> {
  try {
    return { ok: true, data: await apiClient.getAdminProfileEvaluation(buddyId) }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { ok: true, data: null }
    }
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function upsertAdminProfileEvaluation(
  buddyId: string,
  data: UpsertAdminProfileEvaluation,
): Promise<ActionResult<AdminProfileEvaluationResponse>> {
  try {
    return { ok: true, data: await apiClient.upsertAdminProfileEvaluation(buddyId, data) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}

export async function listAdminSelfEvaluations(
  params: { buddyId?: string },
): Promise<ActionResult<AdminSelfEvaluationResponse[]>> {
  try {
    return { ok: true, data: await apiClient.listAdminSelfEvaluations(params) }
  } catch (err) {
    return { ok: false, error: classifyApiError(err) }
  }
}
