import { describe, it, expect } from 'vitest'
import {
  emptySelfScores,
  emptySelfNotes,
  fromSelfResponse,
  buildSelfPayload,
  mapSelfEvalError,
} from './self-evaluation-form-state'
import type { SelfEvaluationResponse } from '@peace-buddy/types'

const baseResponse: SelfEvaluationResponse = {
  id: 'seval-1',
  buddyId: 'buddy-1',
  tourId: 'tour-1',
  overallRating: 4,
  overallRatingNote: 'good',
  communication: 3,
  communicationNote: null,
  groupEngagement: null,
  groupEngagementNote: null,
  memory: 5,
  memoryNote: 'excellent',
  knowledge: null,
  knowledgeNote: null,
  dedication: null,
  dedicationNote: null,
  dialogue: null,
  dialogueNote: null,
  adaptability: null,
  adaptabilityNote: null,
  emotionNote: 'felt good',
  confidence: null,
  confidenceNote: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  locked: false,
}

describe('emptySelfScores', () => {
  it('returns all null scores', () => {
    const scores = emptySelfScores()
    expect(Object.values(scores).every((v) => v === null)).toBe(true)
  })

  it('has exactly 9 score fields', () => {
    expect(Object.keys(emptySelfScores())).toHaveLength(9)
  })
})

describe('emptySelfNotes', () => {
  it('returns all empty string notes', () => {
    const notes = emptySelfNotes()
    expect(Object.values(notes).every((v) => v === '')).toBe(true)
  })

  it('has exactly 10 note fields', () => {
    expect(Object.keys(emptySelfNotes())).toHaveLength(10)
  })
})

describe('fromSelfResponse', () => {
  it('maps scores from response', () => {
    const { scores } = fromSelfResponse(baseResponse)
    expect(scores.overallRating).toBe(4)
    expect(scores.communication).toBe(3)
    expect(scores.memory).toBe(5)
    expect(scores.groupEngagement).toBeNull()
    expect(scores.knowledge).toBeNull()
  })

  it('maps non-null notes from response', () => {
    const { notes } = fromSelfResponse(baseResponse)
    expect(notes.overallRatingNote).toBe('good')
    expect(notes.memoryNote).toBe('excellent')
    expect(notes.emotionNote).toBe('felt good')
  })

  it('converts null notes to empty string', () => {
    const { notes } = fromSelfResponse(baseResponse)
    expect(notes.communicationNote).toBe('')
    expect(notes.groupEngagementNote).toBe('')
    expect(notes.confidenceNote).toBe('')
  })
})

describe('buildSelfPayload', () => {
  it('passes scores through as-is including nulls', () => {
    const scores = { ...emptySelfScores(), overallRating: 4, communication: 3 }
    const notes = emptySelfNotes()
    const payload = buildSelfPayload(scores, notes)
    expect(payload.overallRating).toBe(4)
    expect(payload.communication).toBe(3)
    expect(payload.memory).toBeNull()
  })

  it('converts non-empty notes to string values', () => {
    const scores = emptySelfScores()
    const notes = { ...emptySelfNotes(), overallRatingNote: 'great', emotionNote: 'calm' }
    const payload = buildSelfPayload(scores, notes)
    expect(payload.overallRatingNote).toBe('great')
    expect(payload.emotionNote).toBe('calm')
  })

  it('converts empty string notes to null', () => {
    const scores = emptySelfScores()
    const notes = emptySelfNotes()
    const payload = buildSelfPayload(scores, notes)
    expect(payload.overallRatingNote).toBeNull()
    expect(payload.communicationNote).toBeNull()
    expect(payload.emotionNote).toBeNull()
    expect(payload.confidenceNote).toBeNull()
  })
})

describe('mapSelfEvalError', () => {
  const t = (key: string) => key

  it('maps not_found', () => {
    expect(mapSelfEvalError(t, 'not_found')).toBe('error.notFound')
  })

  it('maps forbidden to notEligible', () => {
    expect(mapSelfEvalError(t, 'forbidden')).toBe('error.notEligible')
  })

  it('maps conflict to locked', () => {
    expect(mapSelfEvalError(t, 'conflict')).toBe('error.locked')
  })

  it('maps invalid_request', () => {
    expect(mapSelfEvalError(t, 'invalid_request')).toBe('error.invalidRequest')
  })

  it('maps network', () => {
    expect(mapSelfEvalError(t, 'network')).toBe('error.network')
  })

  it('defaults unknown codes to error.unknown', () => {
    expect(mapSelfEvalError(t, 'something_else')).toBe('error.unknown')
  })
})
