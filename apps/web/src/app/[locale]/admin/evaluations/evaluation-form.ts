import { AppErrorCodeSchema } from '@peace-buddy/types'
import type { UpdateAdminEvaluation } from '@peace-buddy/types'

export type ScoreState = {
  overallRating: number | null
  reliability: number | null
  communication: number | null
  groupEngagement: number | null
  memory: number | null
  knowledge: number | null
  dedication: number | null
  dialogue: number | null
  adaptability: number | null
  confidence: number | null
}

export type NoteState = {
  overallRatingNote: string
  reliabilityNote: string
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

export function emptyScores(): ScoreState {
  return {
    overallRating: null, reliability: null, communication: null,
    groupEngagement: null, memory: null, knowledge: null,
    dedication: null, dialogue: null, adaptability: null, confidence: null,
  }
}

export function emptyNotes(): NoteState {
  return {
    overallRatingNote: '', reliabilityNote: '', communicationNote: '',
    groupEngagementNote: '', memoryNote: '', knowledgeNote: '',
    dedicationNote: '', dialogueNote: '', adaptabilityNote: '',
    emotionNote: '', confidenceNote: '',
  }
}

type HasEvalFields = {
  overallRating: number | null
  overallRatingNote: string | null
  reliability: number | null
  reliabilityNote: string | null
  communication: number | null
  communicationNote: string | null
  groupEngagement: number | null
  groupEngagementNote: string | null
  memory: number | null
  memoryNote: string | null
  knowledge: number | null
  knowledgeNote: string | null
  dedication: number | null
  dedicationNote: string | null
  dialogue: number | null
  dialogueNote: string | null
  adaptability: number | null
  adaptabilityNote: string | null
  emotionNote: string | null
  confidence: number | null
  confidenceNote: string | null
  absentWithoutReport?: boolean
}

export function fromResponse(data: HasEvalFields): { scores: ScoreState; notes: NoteState; absentWithoutReport: boolean } {
  return {
    scores: {
      overallRating: data.overallRating,
      reliability: data.reliability,
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
      reliabilityNote: data.reliabilityNote ?? '',
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
    absentWithoutReport: data.absentWithoutReport ?? false,
  }
}

// Sends all fields: null scores clear existing values, empty notes send null to clear.
export function buildPayload(scores: ScoreState, notes: NoteState, absentWithoutReport = false): UpdateAdminEvaluation {
  return {
    overallRating: scores.overallRating,
    overallRatingNote: notes.overallRatingNote || null,
    reliability: scores.reliability,
    reliabilityNote: notes.reliabilityNote || null,
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
    absentWithoutReport,
  }
}

export function mapEvalError(t: (k: string) => string, code: string): string {
  switch (code) {
    case AppErrorCodeSchema.enum.not_found: return t('error.notFound')
    case AppErrorCodeSchema.enum.forbidden: return t('error.forbidden')
    case AppErrorCodeSchema.enum.conflict: return t('error.conflict')
    case AppErrorCodeSchema.enum.invalid_request: return t('error.invalid_request')
    case AppErrorCodeSchema.enum.network: return t('error.network')
    default: return t('error.unknown')
  }
}
