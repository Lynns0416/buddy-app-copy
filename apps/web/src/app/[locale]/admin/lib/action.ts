import type { AppError } from '@peace-buddy/types'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: AppError }
