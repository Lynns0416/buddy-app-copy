import { cn } from '@/lib/utils'

interface EvaluationScorePipsProps {
  value: number | null
}

const SCORES = [1, 2, 3, 4, 5] as const

export function EvaluationScorePips({ value }: EvaluationScorePipsProps) {
  return (
    <div className="flex items-center gap-1">
      {SCORES.map((score) => (
        <span
          key={score}
          className={cn(
            'inline-block h-3 w-3 rounded-sm',
            value !== null && score <= value ? 'bg-primary' : 'bg-muted',
          )}
        />
      ))}
    </div>
  )
}
