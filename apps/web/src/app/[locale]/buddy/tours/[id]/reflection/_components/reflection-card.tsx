'use client'

import { useTranslations } from 'next-intl'
import { REFLECTION_PROMPTS } from '@peace-buddy/types'
import type { TourReflectionResponse } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format-date'

interface ReflectionCardProps {
  reflection: TourReflectionResponse
  onEdit?: () => void
  savedFlash?: boolean
}

export function ReflectionCard({ reflection, onEdit, savedFlash }: ReflectionCardProps) {
  const t = useTranslations('reflections')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t('summary.submittedAt', { date: formatDate(reflection.createdAt) })}</span>
          {reflection.locked && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t('summary.locked')}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {savedFlash && <span className="text-xs text-green-600">{t('summary.saved')}</span>}
          {onEdit && !reflection.locked && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              {t('summary.edit')}
            </Button>
          )}
        </div>
      </div>

      <dl className="space-y-3">
        {REFLECTION_PROMPTS.filter((key) => reflection[key]).map((key) => (
          <div key={key} className="space-y-0.5">
            <dt className="text-sm text-muted-foreground">{t(`prompts.${key}`)}</dt>
            <dd className="whitespace-pre-wrap border-l pl-2 text-sm">{reflection[key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
