import { describe, it, expect } from 'vitest'
import type { AdminTourDetailResponse } from '@peace-buddy/types'
import { sessionChanges, sessionConflictKey } from './session-changes'
import type { SessionFormValues } from './tour-form'

const session: AdminTourDetailResponse['sessions'][number] = {
  id: 's1',
  order: 1,
  label: null,
  meetingTime: '1970-01-01T09:30:00.000Z',
  startTime: null,
  endTime: null,
  capacity: 10,
  minBuddies: null,
  participantCount: 0,
  belowMinimum: false,
  place: { id: 'place-1', nameJa: '平和公園', nameEn: 'Peace Park' },
}

const unchanged: SessionFormValues = {
  label: undefined,
  meetingTime: '09:30',
  capacity: 10,
  minBuddies: null,
  participantCount: 0,
  placeId: 'place-1',
}

describe('sessionChanges', () => {
  it('returns no changes when the values match the saved session', () => {
    expect(sessionChanges(session, unchanged)).toEqual({})
  })

  it('returns only the fields that differ', () => {
    expect(sessionChanges(session, { ...unchanged, meetingTime: '10:00', capacity: 12 })).toEqual({ meetingTime: '10:00', capacity: 12 })
  })

  it('sends a cleared label as null', () => {
    expect(sessionChanges({ ...session, label: 'Morning' }, unchanged)).toEqual({ label: null })
  })

  it('sends every editable field when all of them change', () => {
    expect(sessionChanges(session, {
      label: 'Morning',
      meetingTime: '10:00',
      capacity: 12,
      minBuddies: 3,
      participantCount: 20,
      placeId: 'place-2',
    })).toEqual({ label: 'Morning', meetingTime: '10:00', capacity: 12, minBuddies: 3, participantCount: 20, placeId: 'place-2' })
  })
})

describe('sessionConflictKey', () => {
  it('blames the place lock when only the place changed', () => {
    expect(sessionConflictKey({ placeId: 'place-2', label: 'Morning' })).toBe('placeInUse')
  })

  it('blames the capacity lock when only the capacity changed', () => {
    expect(sessionConflictKey({ capacity: 1, meetingTime: '10:00' })).toBe('capacityBelowConfirmed')
  })

  it('names neither lock when both the place and the capacity changed', () => {
    expect(sessionConflictKey({ placeId: 'place-2', capacity: 1 })).toBeNull()
  })
})
