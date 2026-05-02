import type { AppError } from '@peace-buddy/types'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import { ApiError } from '@/lib/api'

export function classifyApiError(err: unknown): AppError {
  if (err instanceof ApiError) {
    if (err.status === 404) return { code: AppErrorCodeSchema.enum.not_found }
    if (err.status === 403) return { code: AppErrorCodeSchema.enum.forbidden }
    if (err.status === 409) return { code: AppErrorCodeSchema.enum.conflict }
    if (err.status === 400) return { code: AppErrorCodeSchema.enum.invalid_request }
    return { code: AppErrorCodeSchema.enum.unknown }
  }
  return { code: AppErrorCodeSchema.enum.network }
}
