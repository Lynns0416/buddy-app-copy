'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AdminTourSummaryResponse } from '@peace-buddy/types'
import { TourStatusSchema } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { routes } from '@/lib/routes'
import { getTourStatusLabel, tourStatusDotClass } from '@/lib/status-display'
import { monthGrid, shiftMonth, toursByDate, type CalendarCell } from '../admin.tour'
import { formatDate } from '@/lib/format-date'

type Props = {
  tours: AdminTourSummaryResponse[]
  month: string
  today: string
  locale: string
  onMonthChange: (month: string) => void
}

// Three chips is what a cell holds before the six rows stop fitting a laptop
// screen; the rest collapse into a count rather than making the row scroll.
const CHIPS_PER_CELL = 3

export function TourCalendar({ tours, month, today, locale, onMonthChange }: Props) {
  const t = useTranslations('adminTours')
  const byDate = toursByDate(tours)
  const cells = monthGrid(month)
  // The padding days belong to the neighbouring months and carry no chips —
  // they exist to hold the grid at six rows. `inMonth` is the only rule here,
  // and the grid, the agenda and the empty notice all read it.
  const toursOn = (cell: CalendarCell) => (cell.inMonth && byDate.get(cell.date)) || []
  const monthHasTours = cells.some((c) => toursOn(c).length > 0)

  // Any Monday-first week does; 2024-01-01 was one. Weekday and month names come
  // from the locale rather than the message files — they are calendar data, not copy.
  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(2024, 0, 1 + i))),
  )
  const monthLabel = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00.000Z`))

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={t('calendar.previousMonth')}
          onClick={() => onMonthChange(shiftMonth(month, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('calendar.nextMonth')}
          onClick={() => onMonthChange(shiftMonth(month, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onMonthChange(today.slice(0, 7))}>
          {t('calendar.today')}
        </Button>
        <h2 className="ml-2 text-base font-semibold tabular-nums">{monthLabel}</h2>
      </div>

      {!monthHasTours && (
        <p className="mb-3 text-sm text-muted-foreground">{t('calendar.emptyMonth')}</p>
      )}

      {/* Desktop month grid */}
      <div className="hidden overflow-hidden rounded-lg border bg-card sm:block">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {weekdayNames.map((name) => (
            <div key={name} className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
              {name}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell) => (
            <DayCell
              key={cell.date}
              cell={cell}
              today={today}
              locale={locale}
              tours={toursOn(cell)}
            />
          ))}
        </div>
      </div>

      {/* Mobile agenda — a 7-column grid is unreadable at phone width. */}
      <div className="space-y-3 sm:hidden">
        {cells
          .filter((cell) => toursOn(cell).length > 0)
          .map((cell) => (
            <div key={cell.date}>
              <p className="mb-1 text-xs font-medium tabular-nums text-muted-foreground">
                {formatDate(cell.date)}
                {cell.date === today && <span className="ml-2">{t('calendar.today')}</span>}
              </p>
              <div className="space-y-1">
                {toursOn(cell).map((tour) => (
                  <TourChip key={tour.id} tour={tour} locale={locale} />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function DayCell({
  cell,
  today,
  locale,
  tours,
}: {
  cell: CalendarCell
  today: string
  locale: string
  tours: AdminTourSummaryResponse[]
}) {
  const t = useTranslations('adminTours')
  const [expanded, setExpanded] = useState(false)
  const isToday = cell.date === today
  const shown = expanded ? tours : tours.slice(0, CHIPS_PER_CELL)
  const hidden = tours.length - shown.length
  const dayNumber = Number(cell.date.slice(8, 10))

  return (
    <div
      className={`min-h-24 border-b border-r p-1 last:border-r-0 ${cell.inMonth ? '' : 'bg-muted/30'}`}
      data-date={cell.date}
    >
      <div className="mb-1 flex justify-end">
        <span
          className={
            isToday
              ? 'flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold tabular-nums text-primary-foreground'
              : `px-1 text-xs tabular-nums ${cell.inMonth ? 'text-muted-foreground' : 'text-muted-foreground/50'}`
          }
        >
          {dayNumber}
        </span>
      </div>
      <div className="space-y-0.5">
        {shown.map((tour) => (
          <TourChip key={tour.id} tour={tour} locale={locale} />
        ))}
        {hidden > 0 && (
          <button
            className="w-full px-1 text-left text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(true)}
          >
            {t('calendar.more', { count: hidden })}
          </button>
        )}
      </div>
    </div>
  )
}

function TourChip({ tour, locale }: { tour: AdminTourSummaryResponse; locale: string }) {
  const t = useTranslations('adminTours')
  const tTourStatus = useTranslations('tourStatus')
  const belowMinimum = tour.sessions.some((s) => s.belowMinimum)
  const cancelled = tour.status === TourStatusSchema.enum.cancelled

  return (
    <Link
      href={routes.adminTourDetail(locale, tour.id)}
      className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] hover:bg-muted"
      title={t('calendar.chipTitle', {
        group: tour.group.name,
        status: getTourStatusLabel(tTourStatus, tour.status),
        location: tour.location,
      })}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${tourStatusDotClass[tour.status]}`}
        aria-hidden="true"
      />
      <span className={`truncate ${cancelled ? 'text-muted-foreground line-through' : ''}`}>
        {tour.group.name}
      </span>
      <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
        {tour.confirmedCount}/{tour.capacity}
      </span>
      {belowMinimum && (
        <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" aria-label={t('belowMinimum')} />
      )}
    </Link>
  )
}
