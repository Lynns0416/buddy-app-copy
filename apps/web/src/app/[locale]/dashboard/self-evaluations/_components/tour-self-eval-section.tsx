'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { SelfEvaluationResponse } from '@peace-buddy/types'
import { listMySelfEvaluations } from '../self-evaluation'
import { mapSelfEvalError } from '../self-evaluation-form-state'
import { SelfEvaluationForm } from './self-evaluation-form'
import { SelfEvaluationCard } from './self-evaluation-card'

interface TourSelfEvalSectionProps {
  tourId: string
}

export function TourSelfEvalSection({ tourId }: TourSelfEvalSectionProps) {
  const t = useTranslations('selfEvaluations')
  const [existing, setExisting] = useState<SelfEvaluationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    listMySelfEvaluations({ tourId }).then((result) => {
      if (!result.ok) {
        setLoadError(mapSelfEvalError(t, result.error.code))
      } else {
        const ev = result.data[0] ?? null
        setExisting(ev)
        setOpen(ev === null)
      }
      setLoading(false)
    })
  }, [tourId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaved(saved: SelfEvaluationResponse) {
    setExisting(saved)
    setOpen(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  if (loading) return null

  if (loadError) {
    return <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{loadError}</p>
  }

  // Card view (both locked and unlocked-but-submitted)
  if (existing && !open) {
    return (
      <SelfEvaluationCard
        evaluation={existing}
        onEdit={() => setOpen(true)}
        savedFlash={savedFlash}
      />
    )
  }

  // Form (first submission or editing)
  return (
    <SelfEvaluationForm
      tourId={tourId}
      existing={existing}
      onSaved={handleSaved}
      onCancel={existing ? () => setOpen(false) : undefined}
    />
  )
}
