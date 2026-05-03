import { useTranslations } from 'next-intl'
import type { AdminEvalScores } from '@peace-buddy/types'
import { EvaluationScorePips } from './evaluation-score-pips'

interface EvaluationScoreGridProps {
  scores: AdminEvalScores
}

export function EvaluationScoreGrid({ scores }: EvaluationScoreGridProps) {
  const t = useTranslations('adminEvaluations')

  const fields: { key: keyof AdminEvalScores; noteKey: keyof AdminEvalScores; label: string }[] = [
    { key: 'overallRating', noteKey: 'overallRatingNote', label: t('fields.overallRating') },
    { key: 'reliability', noteKey: 'reliabilityNote', label: t('fields.reliability') },
    { key: 'communication', noteKey: 'communicationNote', label: t('fields.communication') },
    { key: 'groupEngagement', noteKey: 'groupEngagementNote', label: t('fields.groupEngagement') },
    { key: 'memory', noteKey: 'memoryNote', label: t('fields.memory') },
    { key: 'knowledge', noteKey: 'knowledgeNote', label: t('fields.knowledge') },
    { key: 'dedication', noteKey: 'dedicationNote', label: t('fields.dedication') },
    { key: 'dialogue', noteKey: 'dialogueNote', label: t('fields.dialogue') },
    { key: 'adaptability', noteKey: 'adaptabilityNote', label: t('fields.adaptability') },
    { key: 'confidence', noteKey: 'confidenceNote', label: t('fields.confidence') },
  ]

  const notes = fields
    .filter((f) => scores[f.noteKey])
    .map((f) => ({ label: f.label, text: scores[f.noteKey] as string }))

  if (scores.emotionNote) {
    notes.push({ label: t('fields.emotionNote'), text: scores.emotionNote })
  }

  return (
    <div className="space-y-2 pt-1">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {fields.map((f) => (
          <div key={f.key as string} className="flex items-center gap-2">
            <span className="min-w-0 shrink-0 text-xs text-muted-foreground">{f.label}</span>
            <EvaluationScorePips value={scores[f.key] as number | null} />
          </div>
        ))}
      </div>
      {notes.length > 0 && (
        <div className="space-y-1">
          {notes.map((n) => (
            <p key={n.label} className="text-xs text-muted-foreground">
              <span className="font-medium">{n.label}:</span> {n.text}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
