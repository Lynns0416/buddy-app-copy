'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { REFLECTION_PROMPTS } from '@peace-buddy/types'
import type { ReflectionPrompt, TourReflectionResponse } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { createReflection, updateReflection } from '../reflection'
import {
  type ReflectionPromptState,
  emptyPrompts,
  fromReflectionResponse,
  buildReflectionPayload,
  hasAnyAnswer,
  mapReflectionError,
} from '../reflection-form-state'

interface ReflectionFormProps {
  sessionId: string
  existing: TourReflectionResponse | null
  onSaved: (reflection: TourReflectionResponse) => void
  onCancel?: () => void
}

export function ReflectionForm({ sessionId, existing, onSaved, onCancel }: ReflectionFormProps) {
  const t = useTranslations('reflections')

  const [prompts, setPrompts] = useState<ReflectionPromptState>(
    existing ? fromReflectionResponse(existing) : emptyPrompts(),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setPrompt(key: ReflectionPrompt, value: string) {
    setPrompts((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = buildReflectionPayload(prompts)
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

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !hasAnyAnswer(prompts)}>
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
