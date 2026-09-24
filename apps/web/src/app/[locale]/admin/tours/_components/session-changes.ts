import type { AdminTourDetailResponse, UpdateTourSession } from '@peace-buddy/types'
import type { SessionFormValues } from './tour-form'

/**
 * Only the fields that differ from the saved session — an unchanged place never
 * hits the place-in-use lock, and an unchanged meeting time never notifies.
 */
export function sessionChanges(
  session: AdminTourDetailResponse['sessions'][number],
  values: SessionFormValues,
): UpdateTourSession {
  const changes: UpdateTourSession = {}
  if ((values.label ?? '') !== (session.label ?? '')) changes.label = values.label ?? null
  if (values.meetingTime !== session.meetingTime.slice(11, 16)) changes.meetingTime = values.meetingTime
  if (values.capacity !== session.capacity) changes.capacity = values.capacity
  if (values.minBuddies !== session.minBuddies) changes.minBuddies = values.minBuddies
  if (values.participantCount !== session.participantCount) changes.participantCount = values.participantCount
  if (values.placeId !== session.place.id) changes.placeId = values.placeId
  return changes
}

/**
 * Which lock a 409 on these changes hit. Both the place and the capacity lock
 * answer 409, so when both changed the cause is unknown and this returns null.
 */
export function sessionConflictKey(changes: UpdateTourSession): 'placeInUse' | 'capacityBelowConfirmed' | null {
  const placeChanged = changes.placeId !== undefined
  const capacityChanged = changes.capacity !== undefined
  if (placeChanged && !capacityChanged) return 'placeInUse'
  if (capacityChanged && !placeChanged) return 'capacityBelowConfirmed'
  return null
}
