'use client'

import { useTranslations } from 'next-intl'
import type { SelfEvaluationResponse } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { EvaluationScorePips } from '@/components/evaluation-score-pips'

interface SelfEvaluationCardProps {
  evaluation: SelfEvaluationResponse
  onEdit?: () => void
  savedFlash?: boolean
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso))
}

const SCORE_FIELDS = [
  'overallRating',
  'communication',
  'groupEngagement',
  'memory',
  'knowledge',
  'dedication',
  'dialogue',
  'adaptability',
  'confidence',
] as const

type ScoreField = (typeof SCORE_FIELDS)[number]

const NOTE_KEYS: Record<ScoreField, keyof SelfEvaluationResponse> = {
  overallRating: 'overallRatingNote',
  communication: 'communicationNote',
  groupEngagement: 'groupEngagementNote',
  memory: 'memoryNote',
  knowledge: 'knowledgeNote',
  dedication: 'dedicationNote',
  dialogue: 'dialogueNote',
  adaptability: 'adaptabilityNote',
  confidence: 'confidenceNote',
}

export function SelfEvaluationCard({ evaluation, onEdit, savedFlash }: SelfEvaluationCardProps) {
  const t = useTranslations('selfEvaluations')

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t('summary.submittedAt', { date: formatDate(evaluation.createdAt) })}</span>
          {evaluation.locked && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t('summary.locked')}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {savedFlash && <span className="text-xs text-green-600">{t('summary.saved')}</span>}
          {onEdit && !evaluation.locked && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              {t('summary.edit')}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {SCORE_FIELDS.map((field) => {
          const score = evaluation[field] as number | null
          const noteKey = NOTE_KEYS[field]
          const note = evaluation[noteKey] as string | null
          return (
            <div key={field} className="space-y-1">
              <div className="flex items-center gap-6 text-sm">
                <span className="shrink-0 text-muted-foreground">{t(`fields.${field}`)}</span>
                <EvaluationScorePips value={score} />
              </div>
              {note && (
                <p className="text-xs text-muted-foreground pl-2 border-l">{note}</p>
              )}
            </div>
          )
        })}

        {evaluation.emotionNote && (
          <div className="text-sm space-y-0.5">
            <span className="text-muted-foreground">{t('fields.emotionNote')}</span>
            <p className="text-xs text-muted-foreground pl-2 border-l">{evaluation.emotionNote}</p>
          </div>
        )}
      </div>
    </div>
  )
}
