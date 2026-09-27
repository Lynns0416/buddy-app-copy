'use client'

import { useLocale, useTranslations } from 'next-intl'
import { REFLECTION_PROMPTS } from '@peace-buddy/types'
import type { AdminTourReflectionResponse } from '@peace-buddy/types'
import { momentLocation } from '@/lib/place-names'

// A reflection's answered prompts and its moments, as a PLAB member reads them.
export function ReflectionDetail({ reflection }: { reflection: AdminTourReflectionResponse }) {
  const t = useTranslations('adminEvaluations')
  const locale = useLocale()
  return (
    <dl className="space-y-2 py-2 text-sm">
      {REFLECTION_PROMPTS.filter((key) => reflection[key]).map((key) => (
        <div key={key}>
          <dt className="text-muted-foreground">{t(`reflectionPrompts.${key}`)}</dt>
          <dd className="whitespace-pre-wrap">{reflection[key]}</dd>
        </div>
      ))}
      {reflection.moments.length > 0 && (
        <div>
          <dt className="text-muted-foreground">{t('reflectionMoments.heading')}</dt>
          {reflection.moments.map((moment) => (
            <dd key={moment.id} className="whitespace-pre-wrap">
              <span className="text-xs text-muted-foreground">{momentLocation(moment, locale)}</span>
              <br />
              {moment.description}
            </dd>
          ))}
        </div>
      )}
    </dl>
  )
}
