'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import type { SelfEvaluationResponse } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { EvaluationScoreField } from '@/components/evaluation-score-field'
import { createSelfEvaluation, updateSelfEvaluation } from '../self-evaluation'
import {
  type SelfScoreState,
  type SelfNoteState,
  emptySelfScores,
  emptySelfNotes,
  fromSelfResponse,
  buildSelfPayload,
  mapSelfEvalError,
} from '../self-evaluation-form-state'

interface SelfEvaluationFormProps {
  tourId: string
  existing: SelfEvaluationResponse | null
  onSaved: (eval_: SelfEvaluationResponse) => void
}

export function SelfEvaluationForm({ tourId, existing, onSaved }: SelfEvaluationFormProps) {
  const t = useTranslations('selfEvaluations')

  const init = existing ? fromSelfResponse(existing) : { scores: emptySelfScores(), notes: emptySelfNotes() }
  const [scores, setScores] = useState<SelfScoreState>(init.scores)
  const [notes, setNotes] = useState<SelfNoteState>(init.notes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setScore(key: keyof SelfScoreState, value: number | null) {
    setScores((prev) => ({ ...prev, [key]: value }))
  }

  function setNote(key: keyof SelfNoteState, value: string) {
    setNotes((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = existing
      ? await updateSelfEvaluation(existing.id, buildSelfPayload(scores, notes))
      : await createSelfEvaluation({ tourId, ...buildSelfPayload(scores, notes) })

    setSaving(false)
    if (result.ok) {
      onSaved(result.data)
    } else {
      setError(mapSelfEvalError(t, result.error.code))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
      )}

      <p className="text-xs text-muted-foreground">{t('scoreLegend')}</p>

      <EvaluationScoreField label={t('fields.overallRating')} value={scores.overallRating} noteValue={notes.overallRatingNote} onChange={(v) => setScore('overallRating', v)} noteOnChange={(v) => setNote('overallRatingNote', v)} disabled={saving} />
      <EvaluationScoreField label={t('fields.communication')} value={scores.communication} noteValue={notes.communicationNote} onChange={(v) => setScore('communication', v)} noteOnChange={(v) => setNote('communicationNote', v)} disabled={saving} />
      <EvaluationScoreField label={t('fields.groupEngagement')} value={scores.groupEngagement} noteValue={notes.groupEngagementNote} onChange={(v) => setScore('groupEngagement', v)} noteOnChange={(v) => setNote('groupEngagementNote', v)} disabled={saving} />
      <EvaluationScoreField label={t('fields.memory')} value={scores.memory} noteValue={notes.memoryNote} onChange={(v) => setScore('memory', v)} noteOnChange={(v) => setNote('memoryNote', v)} disabled={saving} />
      <EvaluationScoreField label={t('fields.knowledge')} value={scores.knowledge} noteValue={notes.knowledgeNote} onChange={(v) => setScore('knowledge', v)} noteOnChange={(v) => setNote('knowledgeNote', v)} disabled={saving} />
      <EvaluationScoreField label={t('fields.dedication')} value={scores.dedication} noteValue={notes.dedicationNote} onChange={(v) => setScore('dedication', v)} noteOnChange={(v) => setNote('dedicationNote', v)} disabled={saving} />
      <EvaluationScoreField label={t('fields.dialogue')} value={scores.dialogue} noteValue={notes.dialogueNote} onChange={(v) => setScore('dialogue', v)} noteOnChange={(v) => setNote('dialogueNote', v)} disabled={saving} />
      <EvaluationScoreField label={t('fields.adaptability')} value={scores.adaptability} noteValue={notes.adaptabilityNote} onChange={(v) => setScore('adaptability', v)} noteOnChange={(v) => setNote('adaptabilityNote', v)} disabled={saving} />
      <EvaluationScoreField label={t('fields.confidence')} value={scores.confidence} noteValue={notes.confidenceNote} onChange={(v) => setScore('confidence', v)} noteOnChange={(v) => setNote('confidenceNote', v)} disabled={saving} />

      <div className="space-y-1.5">
        <p className="text-sm font-medium">{t('fields.emotionNote')}</p>
        <textarea
          value={notes.emotionNote}
          disabled={saving}
          onChange={(e) => setNote('emotionNote', e.target.value)}
          rows={2}
          className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
      </div>

      <Button type="submit" disabled={saving}>{t('actions.save')}</Button>
    </form>
  )
}
