'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { SelfEvaluationResponse } from '@peace-buddy/types'
import { listMySelfEvaluations } from '../self-evaluation'
import { mapSelfEvalError } from '../self-evaluation-form-state'
import { SelfEvaluationForm } from './self-evaluation-form'

interface TourSelfEvalSectionProps {
  tourId: string
}

export function TourSelfEvalSection({ tourId }: TourSelfEvalSectionProps) {
  const t = useTranslations('selfEvaluations')
  const [existing, setExisting] = useState<SelfEvaluationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    listMySelfEvaluations({ tourId }).then((result) => {
      if (!result.ok) {
        setLoadError(mapSelfEvalError(t, result.error.code))
      } else {
        setExisting(result.data[0] ?? null)
      }
      setLoading(false)
    })
  }, [tourId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null

  if (loadError) {
    return <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{loadError}</p>
  }

  if (existing?.locked) {
    const submittedDate = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(existing.createdAt))

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('lockedNote', { date: submittedDate })}
        </p>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {(
            [
              [t('fields.overallRating'), existing.overallRating],
              [t('fields.communication'), existing.communication],
              [t('fields.groupEngagement'), existing.groupEngagement],
              [t('fields.memory'), existing.memory],
              [t('fields.knowledge'), existing.knowledge],
              [t('fields.dedication'), existing.dedication],
              [t('fields.dialogue'), existing.dialogue],
              [t('fields.adaptability'), existing.adaptability],
              [t('fields.confidence'), existing.confidence],
            ] as [string, number | null][]
          ).map(([label, score]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{score ?? '—'}</dd>
            </div>
          ))}
          {existing.emotionNote && (
            <div className="col-span-2">
              <dt className="text-muted-foreground">{t('fields.emotionNote')}</dt>
              <dd>{existing.emotionNote}</dd>
            </div>
          )}
        </dl>
      </div>
    )
  }

  return (
    <SelfEvaluationForm
      tourId={tourId}
      existing={existing}
      onSaved={(saved) => setExisting(saved)}
    />
  )
}
