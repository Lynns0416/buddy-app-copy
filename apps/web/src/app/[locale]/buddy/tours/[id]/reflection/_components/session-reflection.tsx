'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { TourReflectionResponse, TourPlaceWithSpots } from '@peace-buddy/types'
import { ReflectionForm } from './reflection-form'
import { ReflectionCard } from './reflection-card'

interface SessionReflectionProps {
  sessionId: string
  place: TourPlaceWithSpots
  locale: string
  heading: string | null
  existing: TourReflectionResponse | null
}

// One session's reflection: the card once something is written, the form until
// then and again while editing.
export function SessionReflection({ sessionId, place, locale, heading, existing }: SessionReflectionProps) {
  const t = useTranslations('reflections')
  const [reflection, setReflection] = useState<TourReflectionResponse | null>(existing)
  const [editing, setEditing] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  function handleSaved(saved: TourReflectionResponse) {
    setReflection(saved)
    setEditing(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-base font-semibold">{heading ?? t('sessionHeading')}</h2>
      {reflection && !editing ? (
        <ReflectionCard
          reflection={reflection}
          locale={locale}
          onEdit={() => setEditing(true)}
          savedFlash={savedFlash}
        />
      ) : (
        <ReflectionForm
          sessionId={sessionId}
          place={place}
          locale={locale}
          existing={reflection}
          onSaved={handleSaved}
          onCancel={reflection ? () => setEditing(false) : undefined}
        />
      )}
    </section>
  )
}
