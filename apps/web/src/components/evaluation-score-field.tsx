'use client'

// Shared by admin evaluation forms and buddy self-evaluation form.
// Uses adminEvaluations namespace (scoreMin, scoreMax, notePlaceholder).

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface EvaluationScoreFieldProps {
  label: string
  value: number | null
  noteValue: string | null
  onChange: (value: number | null) => void
  noteOnChange: (value: string) => void
  disabled?: boolean
}

const SCORES = [1, 2, 3, 4, 5] as const

export function EvaluationScoreField({
  label,
  value,
  noteValue,
  onChange,
  noteOnChange,
  disabled,
}: EvaluationScoreFieldProps) {
  const t = useTranslations('adminEvaluations')

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t('scoreMin')}</span>
        {SCORES.map((score) => (
          <button
            key={score}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value === score ? null : score)}
            className={cn(
              'h-8 w-8 rounded text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              value === score
                ? 'bg-primary text-primary-foreground'
                : 'border bg-background hover:bg-muted',
            )}
          >
            {score}
          </button>
        ))}
        <span className="text-xs text-muted-foreground">{t('scoreMax')}</span>
      </div>
      <textarea
        value={noteValue ?? ''}
        disabled={disabled}
        onChange={(e) => noteOnChange(e.target.value)}
        rows={2}
        placeholder={t('notePlaceholder')}
        className="w-full rounded-md border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
    </div>
  )
}
