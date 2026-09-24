import { AppErrorCodeSchema, REFLECTION_PROMPTS } from '@peace-buddy/types'
import type {
  ReflectionPrompt,
  TourReflectionResponse,
  TourReflectionMomentResponse,
  TourReflectionMomentInput,
  TourPlaceWithSpots,
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

// `placeNote` is always a plain string in form state — never null — so a
// controlled <input>/<textarea> never flips from uncontrolled to controlled.
export type MomentState = {
  spotId: string | null
  placeNote: string
  description: string
}

export function emptyMoment(): MomentState {
  return { spotId: null, placeNote: '', description: '' }
}

export function momentsFromReflectionResponse(moments: TourReflectionMomentResponse[]): MomentState[] {
  return moments.map((m) => ({ spotId: m.spotId, placeNote: m.placeNote ?? '', description: m.description }))
}

// The spot a new moment row starts on: the first active spot of the session's
// place, so a fresh row never reads as Other before the buddy has chosen.
// Null when the place has no active spot.
export function defaultSpotId(place: TourPlaceWithSpots): string | null {
  return place.spots[0]?.id ?? null
}

// Where spots exist the picker opens with one row (PRD §9.3) — on a new
// reflection, and on an edit that has no moments yet.
export function initialMoments(existing: TourReflectionResponse | null, place: TourPlaceWithSpots): MomentState[] {
  if (existing && existing.moments.length > 0) return momentsFromReflectionResponse(existing.moments)
  const spotId = defaultSpotId(place)
  return spotId ? [{ ...emptyMoment(), spotId }] : []
}

// GET /tours/:id lists active spots only. A moment tagged before its spot was
// retired keeps that spot as an option, so the picker neither shows another
// spot in its place nor falls back to the no-spot textarea and drops the
// moment. Same rule as the tour form keeping a retired place pickable.
export function withTaggedSpots(
  place: TourPlaceWithSpots,
  moments: TourReflectionMomentResponse[],
): TourPlaceWithSpots {
  const listed = new Set(place.spots.map((s) => s.id))
  const tagged = moments.flatMap(({ spot }) => {
    if (!spot || spot.place.id !== place.id || listed.has(spot.id)) return []
    listed.add(spot.id)
    return [{ id: spot.id, nameJa: spot.nameJa, nameEn: spot.nameEn }]
  })
  return tagged.length > 0 ? { ...place, spots: [...place.spots, ...tagged] } : place
}

// The no-spot textarea holds one moment whose placeNote is the place name. A
// reflection written while the place still had spots can hold more, or an
// Other note in the buddy's own words, once those spots are retired — the
// textarea would drop or overwrite them, so such a reflection keeps the full
// picker (Other being its only choice). Decided from the saved moments, not
// the live ones, so editing never flips the layout.
export function usesSingleMoment(place: TourPlaceWithSpots, saved: { placeNote: string | null }[]): boolean {
  if (place.spots.length > 0) return false
  if (saved.length > 1) return false
  const note = saved[0]?.placeNote
  return !note || place.nameJa === note || place.nameEn === note
}

// Drops a row the buddy started and abandoned (blank description) rather than
// erroring on it, and drops a row with neither spotId nor placeNote (only
// reachable if a picker renders in some inconsistent state) the same way.
export function buildMomentPayload(moments: MomentState[]): TourReflectionMomentInput[] {
  return moments
    .filter((m) => m.description.trim().length > 0 && (m.spotId != null || m.placeNote.trim().length > 0))
    .map((m) => ({
      spotId: m.spotId,
      placeNote: m.spotId ? null : m.placeNote.trim(),
      description: m.description.trim(),
    }))
}

export function buildReflectionPayload(prompts: ReflectionPromptState, moments: MomentState[]): UpdateTourReflection {
  const promptFields = Object.fromEntries(
    REFLECTION_PROMPTS.map((key) => [key, prompts[key].trim() || null]),
  ) as Record<ReflectionPrompt, string | null>
  return { ...promptFields, moments: buildMomentPayload(moments) }
}

// Mirrors the API's "at least one prompt or moment" rule so the submit button
// can say so before the request is sent rather than after a 400.
export function hasAnyAnswer(prompts: ReflectionPromptState, moments: MomentState[]): boolean {
  return REFLECTION_PROMPTS.some((key) => prompts[key].trim().length > 0) || buildMomentPayload(moments).length > 0
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
