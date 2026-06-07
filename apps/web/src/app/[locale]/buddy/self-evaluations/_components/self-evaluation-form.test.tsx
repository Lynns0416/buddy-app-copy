import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/evaluation-score-field', () => ({
  EvaluationScoreField: () => null,
}))

vi.mock('../self-evaluation', () => ({
  createSelfEvaluation: vi.fn(),
  updateSelfEvaluation: vi.fn(),
}))

vi.mock('../self-evaluation-form-state', () => ({
  emptySelfScores: () => ({}),
  emptySelfNotes: () => ({}),
  fromSelfResponse: () => ({ scores: {}, notes: {} }),
  buildSelfPayload: () => ({}),
  mapSelfEvalError: (_t: unknown, code: string) => code,
}))

import { SelfEvaluationForm } from './self-evaluation-form'
import type { SelfEvaluationResponse } from '@peace-buddy/types'

const mockExisting: SelfEvaluationResponse = {
  id: 'eval-1',
  buddyId: 'buddy-1',
  tourId: 'tour-1',
  overallRating: 3,
  overallRatingNote: null,
  communication: null,
  communicationNote: null,
  groupEngagement: null,
  groupEngagementNote: null,
  memory: null,
  memoryNote: null,
  knowledge: null,
  knowledgeNote: null,
  dedication: null,
  dedicationNote: null,
  dialogue: null,
  dialogueNote: null,
  adaptability: null,
  adaptabilityNote: null,
  emotionNote: null,
  confidence: null,
  confidenceNote: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  locked: false,
}

describe('SelfEvaluationForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows no cancel button when existing is null', () => {
    render(
      <SelfEvaluationForm
        tourId="tour-1"
        existing={null}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.queryByText('actions.cancel')).toBeNull()
  })

  it('shows cancel button when existing is provided and onCancel is set', () => {
    render(
      <SelfEvaluationForm
        tourId="tour-1"
        existing={mockExisting}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('actions.cancel')).toBeTruthy()
  })

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn()
    render(
      <SelfEvaluationForm
        tourId="tour-1"
        existing={mockExisting}
        onSaved={vi.fn()}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByText('actions.cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows no cancel button when onCancel is not provided', () => {
    render(
      <SelfEvaluationForm
        tourId="tour-1"
        existing={mockExisting}
        onSaved={vi.fn()}
      />,
    )
    expect(screen.queryByText('actions.cancel')).toBeNull()
  })
})
