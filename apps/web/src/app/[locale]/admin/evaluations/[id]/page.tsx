'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import type { AdminEvaluationResponse } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { EvaluationScoreField } from '@/components/evaluation-score-field'
import {
  getAdminEvaluation,
  updateAdminEvaluation,
  deleteAdminEvaluation,
} from '../admin.evaluation'
import {
  type ScoreState,
  type NoteState,
  emptyScores,
  emptyNotes,
  fromResponse,
  buildPayload,
  mapEvalError,
} from '../evaluation-form'

export default function AdminEvaluationDetailPage() {
  const { ready, locale } = useAdminGuard()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('adminEvaluations')

  const [ev, setEv] = useState<AdminEvaluationResponse | null>(null)
  const [scores, setScores] = useState<ScoreState>(emptyScores)
  const [notes, setNotes] = useState<NoteState>(emptyNotes)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!ready) return
    getAdminEvaluation(id).then((result) => {
      if (!result.ok) {
        setFetchError(mapEvalError(t, result.error.code))
      } else if (!result.data) {
        setFetchError(t('error.notFound'))
      } else {
        const { scores: s, notes: n } = fromResponse(result.data)
        setEv(result.data)
        setScores(s)
        setNotes(n)
      }
    })
  }, [ready, id]) // eslint-disable-line react-hooks/exhaustive-deps

  function setScore(key: keyof ScoreState, value: number | null) {
    setScores((prev) => ({ ...prev, [key]: value }))
  }

  function setNote(key: keyof NoteState, value: string) {
    setNotes((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ev) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    const result = await updateAdminEvaluation(ev.id, buildPayload(scores, notes))
    setSaving(false)
    if (result.ok) {
      setEv(result.data)
      setSaved(true)
    } else {
      setSaveError(mapEvalError(t, result.error.code))
    }
  }

  async function handleDelete() {
    if (!ev || !window.confirm(t('actions.confirmDelete'))) return
    setDeleting(true)
    const result = await deleteAdminEvaluation(ev.id)
    if (result.ok) {
      router.push(routes.adminBuddyDetail(locale, ev.buddyId))
    } else {
      setSaveError(mapEvalError(t, result.error.code))
      setDeleting(false)
    }
  }

  if (!ready) return null

  if (fetchError) {
    return (
      <AppShell variant="admin">
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{fetchError}</p>
      </AppShell>
    )
  }

  if (!ev) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={routes.adminBuddyDetail(locale, ev.buddyId)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t('detail.back')}
        </Link>
        <Button size="sm" variant="destructive" disabled={deleting} onClick={handleDelete}>
          {t('actions.delete')}
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-semibold">{t('detail.perTourEvalTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('detail.buddy')}: {ev.buddyDisplayName}
          {' · '}
          {t('detail.tour')}:{' '}
          <Link href={routes.adminTourDetail(locale, ev.tourId)} className="hover:underline">
            {ev.tourDate.slice(0, 10)} — {ev.tourGroupName}
          </Link>
        </p>
      </div>

      <div className="max-w-2xl">
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

          <Button type="submit" disabled={saving}>{t('actions.save')}</Button>
        </form>
      </div>
    </AppShell>
  )
}
