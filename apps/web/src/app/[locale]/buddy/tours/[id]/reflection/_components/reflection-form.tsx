'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { REFLECTION_PROMPTS } from '@peace-buddy/types'
import type { ReflectionPrompt, TourReflectionResponse, TourPlaceWithSpots } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { createReflection, updateReflection } from '../reflection'
import {
  type ReflectionPromptState,
  type MomentState,
  emptyPrompts,
  fromReflectionResponse,
  initialMoments,
  defaultSpotId,
  withTaggedSpots,
  usesSingleMoment,
  buildReflectionPayload,
  hasAnyAnswer,
  mapReflectionError,
} from '../reflection-form-state'
import { MomentsEditor } from './moments-editor'

interface ReflectionFormProps {
  sessionId: string
  place: TourPlaceWithSpots
  locale: string
  existing: TourReflectionResponse | null
  onSaved: (reflection: TourReflectionResponse) => void
  onCancel?: () => void
}

export function ReflectionForm({ sessionId, place, locale, existing, onSaved, onCancel }: ReflectionFormProps) {
  const t = useTranslations('reflections')

  const [prompts, setPrompts] = useState<ReflectionPromptState>(
    existing ? fromReflectionResponse(existing) : emptyPrompts(),
  )
  const [moments, setMoments] = useState<MomentState[]>(() => initialMoments(existing, place))
  const pickerPlace = withTaggedSpots(place, existing?.moments ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setPrompt(key: ReflectionPrompt, value: string) {
    setPrompts((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = buildReflectionPayload(prompts, moments)
    const result = existing
      ? await updateReflection(existing.id, payload)
      : await createReflection({ sessionId, ...payload })

    setSaving(false)
    if (result.ok) {
      onSaved(result.data)
    } else {
      setError(mapReflectionError(t, result.error.code, { creating: !existing }))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
      )}

      <p className="text-xs text-muted-foreground">{t('atLeastOne')}</p>

      {REFLECTION_PROMPTS.map((key) => (
        <div key={key} className="space-y-1.5">
          <label htmlFor={`${sessionId}-${key}`} className="block text-sm font-medium">
            {t(`prompts.${key}`)}
          </label>
          <textarea
            id={`${sessionId}-${key}`}
            value={prompts[key]}
            disabled={saving}
            onChange={(e) => setPrompt(key, e.target.value)}
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
      ))}

      <MomentsEditor
        place={pickerPlace}
        newMomentSpotId={defaultSpotId(place)}
        singleMoment={usesSingleMoment(pickerPlace, existing?.moments ?? [])}
        moments={moments}
        onChange={setMoments}
        disabled={saving}
        locale={locale}
        idPrefix={sessionId}
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !hasAnyAnswer(prompts, moments)}>
          {t('actions.save')}
        </Button>
        {onCancel && existing && (
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
            {t('actions.cancel')}
          </Button>
        )}
      </div>
    </form>
  )
}
