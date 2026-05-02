'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import type { AdminEvaluationResponse, AdminBuddyBookingEntry } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { EvaluationScoreField } from '../../_components/evaluation-score-field'
import { createAdminEvaluation } from '../../evaluations/admin.evaluation'
import {
  type ScoreState,
  type NoteState,
  emptyScores,
  emptyNotes,
  buildPayload,
  mapEvalError,
} from '../../evaluations/evaluation-form'

interface BuddyPerTourEvaluationFormProps {
  buddyId: string
  completedBookings: AdminBuddyBookingEntry[]
  onSaved: (eval_: AdminEvaluationResponse) => void
  onCancel: () => void
}

export function BuddyPerTourEvaluationForm({
  buddyId,
  completedBookings,
  onSaved,
  onCancel,
}: BuddyPerTourEvaluationFormProps) {
  const t = useTranslations('adminEvaluations')
  const [tourId, setTourId] = useState('')
  const [scores, setScores] = useState<ScoreState>(emptyScores)
  const [notes, setNotes] = useState<NoteState>(emptyNotes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setScore(key: keyof ScoreState, value: number | null) {
    setScores((prev) => ({ ...prev, [key]: value }))
  }

  function setNote(key: keyof NoteState, value: string) {
    setNotes((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!tourId) return
    setSaving(true)
    setError(null)

    const result = await createAdminEvaluation({ buddyId, tourId, ...buildPayload(scores, notes) })

    setSaving(false)
    if (result.ok) {
      onSaved(result.data)
    } else {
      setError(mapEvalError(t, result.error.code))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-lg border bg-muted/30 p-4">
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-1.5">
        <p className="text-sm font-medium">{t('tourPicker')}</p>
        <select
          value={tourId}
          onChange={(e) => setTourId(e.target.value)}
          required
          disabled={saving}
          className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          <option value="">—</option>
          {completedBookings.map((b) => (
            <option key={b.tourId} value={b.tourId}>
              {b.tour.tourDate.slice(0, 10)} — {b.tour.group.name}
            </option>
          ))}
        </select>
      </div>

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

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{t('actions.save')}</Button>
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
          {t('actions.cancel')}
        </Button>
      </div>
    </form>
  )
}
