'use client'

import { useTranslations } from 'next-intl'
import { Check, CircleHelp, X } from 'lucide-react'
import type { BookingStatus } from '@peace-buddy/types'
import { BookingStatusSchema } from '@peace-buddy/types'
import { cn } from '@/lib/utils'

export type BookingResponse = Exclude<BookingStatus, 'waitlist'>

const base =
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'

// `full` fills the row, for the one session card on the tour page. `compact`
// keeps each button to its label, for Home, where every session repeats them.
const sizes = {
  full: { button: 'min-h-11 flex-1 gap-1.5 px-4 text-sm', icon: 'h-4 w-4' },
  compact: { button: 'h-9 gap-1 px-3.5 text-[13px]', icon: 'h-3.5 w-3.5' },
} as const

// 参加希望 carries the weight; 未定 is a lighter echo of it; 参加不可 is a plain
// answer, not a dangerous one, so it stays neutral.
const style: Record<BookingResponse, string> = {
  confirmed: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
  maybe: 'border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10',
  declined: 'border border-input bg-background text-foreground shadow-sm hover:bg-muted',
}

const icon: Record<BookingResponse, typeof Check> = { confirmed: Check, maybe: CircleHelp, declined: X }

/**
 * A buddy's answer to a session they hold no live booking on: none yet, or
 * 参加不可 (declined), which they can still change. The current answer is
 * left out; 未定 only while it can still be chosen.
 */
export function BookingResponseButtons({
  current,
  canMaybe,
  disabled,
  onRespond,
  size = 'full',
  className,
}: {
  current: typeof BookingStatusSchema.enum.declined | null
  canMaybe: boolean
  disabled?: boolean
  onRespond: (response: BookingResponse) => void
  size?: keyof typeof sizes
  className?: string
}) {
  const t = useTranslations('bookingResponse')
  const options = (['confirmed', 'maybe', 'declined'] as const).filter(
    (r) => r !== current && (r !== BookingStatusSchema.enum.maybe || canMaybe),
  )

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((r) => {
        const Icon = icon[r]
        return (
          <button key={r} type="button" className={cn(base, sizes[size].button, style[r])} disabled={disabled} onClick={() => onRespond(r)}>
            <Icon className={sizes[size].icon} aria-hidden="true" />
            {t(r)}
          </button>
        )
      })}
    </div>
  )
}
