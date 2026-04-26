import type { ApiErrorResponse, AppErrorCode } from '@peace-buddy/types'

export function apiError(code: AppErrorCode, detail?: string): ApiErrorResponse {
  return detail !== undefined ? { code, detail } : { code }
}
