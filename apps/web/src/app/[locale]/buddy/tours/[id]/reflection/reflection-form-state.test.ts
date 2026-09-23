import { describe, it, expect } from 'vitest'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import type { TourReflectionResponse } from '@peace-buddy/types'
import {
  emptyPrompts,
  fromReflectionResponse,
  buildReflectionPayload,
  hasAnyAnswer,
  mapReflectionError,
} from './reflection-form-state'

const response: TourReflectionResponse = {
  id: 'refl-1',
  buddyId: 'buddy-1',
  sessionId: 'session-1',
  sessionOrder: 1,
  sessionLabel: null,
  tourId: 'tour-1',
  didWell: 'Kept everyone together',
  couldImprove: null,
  memorableMoment: 'A student said it could have happened at home',
  notesForOthers: null,
  openQuestions: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  locked: false,
}

describe('emptyPrompts', () => {
  it('starts every prompt as an empty string', () => {
    expect(emptyPrompts()).toEqual({
      didWell: '',
      couldImprove: '',
      memorableMoment: '',
      notesForOthers: '',
      openQuestions: '',
    })
  })
})

describe('fromReflectionResponse', () => {
  it('turns a null prompt into an empty textarea value', () => {
    expect(fromReflectionResponse(response)).toEqual({
      didWell: 'Kept everyone together',
      couldImprove: '',
      memorableMoment: 'A student said it could have happened at home',
      notesForOthers: '',
      openQuestions: '',
    })
  })
})

describe('buildReflectionPayload', () => {
  it('trims answers and sends a blank one as null', () => {
    expect(
      buildReflectionPayload({
        didWell: '  Kept everyone together  ',
        couldImprove: '   ',
        memorableMoment: '',
        notesForOthers: '',
        openQuestions: '',
      }),
    ).toEqual({
      didWell: 'Kept everyone together',
      couldImprove: null,
      memorableMoment: null,
      notesForOthers: null,
      openQuestions: null,
    })
  })
})

describe('hasAnyAnswer', () => {
  it('is false when every prompt is blank or whitespace', () => {
    expect(hasAnyAnswer({ ...emptyPrompts(), couldImprove: '   ' })).toBe(false)
  })

  it('is true when one prompt has content', () => {
    expect(hasAnyAnswer({ ...emptyPrompts(), openQuestions: 'Who funds the programme?' })).toBe(true)
  })
})

describe('mapReflectionError', () => {
  const t = (key: string) => key

  it('maps every error code to its own message key', () => {
    expect(mapReflectionError(t, AppErrorCodeSchema.enum.not_found)).toBe('error.notFound')
    expect(mapReflectionError(t, AppErrorCodeSchema.enum.forbidden)).toBe('error.notEligible')
    expect(mapReflectionError(t, AppErrorCodeSchema.enum.conflict)).toBe('error.locked')
    expect(mapReflectionError(t, AppErrorCodeSchema.enum.conflict, { creating: true })).toBe('error.alreadyExists')
    expect(mapReflectionError(t, AppErrorCodeSchema.enum.invalid_request)).toBe('error.invalidRequest')
    expect(mapReflectionError(t, AppErrorCodeSchema.enum.network)).toBe('error.network')
  })

  it('falls back to the unknown message for an unrecognised code', () => {
    expect(mapReflectionError(t, 'something_else')).toBe('error.unknown')
  })
})
