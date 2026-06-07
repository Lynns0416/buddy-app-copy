import { AppErrorCodeSchema } from '@peace-buddy/types'
import type { SelfEvaluationResponse, UpdateSelfEvaluation } from '@peace-buddy/types'

export type SelfScoreState = {
  overallRating: number | null
  communication: number | null
  groupEngagement: number | null
  memory: number | null
  knowledge: number | null
  dedication: number | null
  dialogue: number | null
  adaptability: number | null
  confidence: number | null
}

export type SelfNoteState = {
  overallRatingNote: string
  communicationNote: string
  groupEngagementNote: string
  memoryNote: string
  knowledgeNote: string
  dedicationNote: string
  dialogueNote: string
  adaptabilityNote: string
  emotionNote: string
  confidenceNote: string
}

export function emptySelfScores(): SelfScoreState {
  return {
    overallRating: null, communication: null, groupEngagement: null,
    memory: null, knowledge: null, dedication: null,
    dialogue: null, adaptability: null, confidence: null,
  }
}

export function emptySelfNotes(): SelfNoteState {
  return {
    overallRatingNote: '', communicationNote: '', groupEngagementNote: '',
    memoryNote: '', knowledgeNote: '', dedicationNote: '',
    dialogueNote: '', adaptabilityNote: '', emotionNote: '', confidenceNote: '',
  }
}

export function fromSelfResponse(data: SelfEvaluationResponse): { scores: SelfScoreState; notes: SelfNoteState } {
  return {
    scores: {
      overallRating: data.overallRating,
      communication: data.communication,
      groupEngagement: data.groupEngagement,
      memory: data.memory,
      knowledge: data.knowledge,
      dedication: data.dedication,
      dialogue: data.dialogue,
      adaptability: data.adaptability,
      confidence: data.confidence,
    },
    notes: {
      overallRatingNote: data.overallRatingNote ?? '',
      communicationNote: data.communicationNote ?? '',
      groupEngagementNote: data.groupEngagementNote ?? '',
      memoryNote: data.memoryNote ?? '',
      knowledgeNote: data.knowledgeNote ?? '',
      dedicationNote: data.dedicationNote ?? '',
      dialogueNote: data.dialogueNote ?? '',
      adaptabilityNote: data.adaptabilityNote ?? '',
      emotionNote: data.emotionNote ?? '',
      confidenceNote: data.confidenceNote ?? '',
    },
  }
}

export function buildSelfPayload(scores: SelfScoreState, notes: SelfNoteState): UpdateSelfEvaluation {
  return {
    overallRating: scores.overallRating,
    overallRatingNote: notes.overallRatingNote || null,
    communication: scores.communication,
    communicationNote: notes.communicationNote || null,
    groupEngagement: scores.groupEngagement,
    groupEngagementNote: notes.groupEngagementNote || null,
    memory: scores.memory,
    memoryNote: notes.memoryNote || null,
    knowledge: scores.knowledge,
    knowledgeNote: notes.knowledgeNote || null,
    dedication: scores.dedication,
    dedicationNote: notes.dedicationNote || null,
    dialogue: scores.dialogue,
    dialogueNote: notes.dialogueNote || null,
    adaptability: scores.adaptability,
    adaptabilityNote: notes.adaptabilityNote || null,
    emotionNote: notes.emotionNote || null,
    confidence: scores.confidence,
    confidenceNote: notes.confidenceNote || null,
  }
}

export function mapSelfEvalError(t: (k: string) => string, code: string): string {
  switch (code) {
    case AppErrorCodeSchema.enum.not_found: return t('error.notFound')
    case AppErrorCodeSchema.enum.forbidden: return t('error.notEligible')
    case AppErrorCodeSchema.enum.conflict: return t('error.locked')
    case AppErrorCodeSchema.enum.invalid_request: return t('error.invalidRequest')
    case AppErrorCodeSchema.enum.network: return t('error.network')
    default: return t('error.unknown')
  }
}
