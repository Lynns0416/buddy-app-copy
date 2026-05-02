'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { EvaluationScoreField } from '@/components/evaluation-score-field'
import { getAdminProfileEvaluation, upsertAdminProfileEvaluation } from '../../evaluations/admin.evaluation'
import {
  type ScoreState,
  type NoteState,
  emptyScores,
  emptyNotes,
  fromResponse,
  buildPayload,
  mapEvalError,
} from '../../evaluations/evaluation-form'

interface AdminProfileEvaluationFormProps {
  buddyId: string
}

export function AdminProfileEvaluationForm({ buddyId }: AdminProfileEvaluationFormProps) {
  const t = useTranslations('adminEvaluations')
  const [scores, setScores] = useState<ScoreState>(emptyScores)
  const [notes, setNotes] = useState<NoteState>(emptyNotes)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAdminProfileEvaluation(buddyId).then((result) => {
      if (!result.ok) {
        setLoadError(mapEvalError(t, result.error.code))
      } else if (result.data) {
        const { scores: s, notes: n } = fromResponse(result.data)
        setScores(s)
        setNotes(n)
      }
      setLoading(false)
    })
  }, [buddyId]) // eslint-disable-line react-hooks/exhaustive-deps

  function setScore(key: keyof ScoreState, value: number | null) {
    setScores((prev) => ({ ...prev, [key]: value }))
  }

  function setNote(key: keyof NoteState, value: string) {
    setNotes((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    setSaved(false)

    const result = await upsertAdminProfileEvaluation(buddyId, buildPayload(scores, notes))
    setSaving(false)
    if (result.ok) {
      setSaved(true)
    } else {
      setSaveError(mapEvalError(t, result.error.code))
    }
  }

  if (loading) return null

  if (loadError) {
    return <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{loadError}</p>
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {saveError && (
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{saveError}</p>
      )}
      {saved && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">{t('messages.saved')}</p>
      )}

      <p className="text-xs text-muted-foreground">{t('scoreLegend')}</p>

      <EvaluationScoreField label={t('fields.overallRating')} value={scores.overallRating} noteValue={notes.overallRatingNote} onChange={(v) => setScore('overallRating', v)} noteOnChange={(v) => setNote('overallRatingNote', v)} disabled={saving} />
      <EvaluationScoreField label={t('fields.reliability')} value={scores.reliability} noteValue={notes.reliabilityNote} onChange={(v) => setScore('reliability', v)} noteOnChange={(v) => setNote('reliabilityNote', v)} disabled={saving} />
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

      <Button type="submit" disabled={saving}>
        {t('actions.save')}
      </Button>
    </form>
  )
}
