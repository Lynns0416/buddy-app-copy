import { AppErrorCodeSchema, REFLECTION_PROMPTS } from '@peace-buddy/types'
import type {
  ReflectionPrompt,
  TourReflectionResponse,
  UpdateTourReflection,
} from '@peace-buddy/types'

export type ReflectionPromptState = Record<ReflectionPrompt, string>

export function emptyPrompts(): ReflectionPromptState {
  return Object.fromEntries(REFLECTION_PROMPTS.map((key) => [key, ''])) as ReflectionPromptState
}

export function fromReflectionResponse(data: TourReflectionResponse): ReflectionPromptState {
  return Object.fromEntries(
    REFLECTION_PROMPTS.map((key) => [key, data[key] ?? '']),
  ) as ReflectionPromptState
}

export function buildReflectionPayload(prompts: ReflectionPromptState): UpdateTourReflection {
  return Object.fromEntries(
    REFLECTION_PROMPTS.map((key) => [key, prompts[key].trim() || null]),
  ) as UpdateTourReflection
}

// Mirrors the API's "at least one prompt" rule so the submit button can say so
// before the request is sent rather than after a 400.
export function hasAnyAnswer(prompts: ReflectionPromptState): boolean {
  return REFLECTION_PROMPTS.some((key) => prompts[key].trim().length > 0)
}

// A 409 means different things per call: on create the session already has a
// reflection, on update the edit window has closed.
export function mapReflectionError(
  t: (k: string) => string,
  code: string,
  { creating = false }: { creating?: boolean } = {},
): string {
  switch (code) {
    case AppErrorCodeSchema.enum.not_found: return t('error.notFound')
    case AppErrorCodeSchema.enum.forbidden: return t('error.notEligible')
    case AppErrorCodeSchema.enum.conflict: return t(creating ? 'error.alreadyExists' : 'error.locked')
    case AppErrorCodeSchema.enum.invalid_request: return t('error.invalidRequest')
    case AppErrorCodeSchema.enum.network: return t('error.network')
    default: return t('error.unknown')
  }
}
