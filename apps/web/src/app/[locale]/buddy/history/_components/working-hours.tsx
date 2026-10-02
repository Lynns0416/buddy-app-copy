'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import type { MyAttendanceDay, MyAttendanceResponse } from '@peace-buddy/types'
import { getTodayJst } from '@peace-buddy/types'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, formatMonth } from '@/lib/format-date'
import { formatDuration, shiftMonth } from '@/lib/attendance'

// The buddy's own attendance days, a month at a time, each with "Report a
// mistake" (PRD §11.10). Late reasons stay with PLAB members.

function DayRow({ day, onFlagged }: { day: MyAttendanceDay; onFlagged: () => void }) {
  const t = useTranslations('workingHours')
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(false)
  const openFlag = day.flag && !day.flag.resolvedAt

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(false)
    try {
      await apiClient.flagMyAttendance(day.date, note.trim())
      setOpen(false)
      setNote('')
      onFlagged()
    } catch {
      setError(true)
    }
    setSending(false)
  }

  return (
    <li className="rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium tabular-nums">{formatDate(day.date)}</p>
        <p className="font-semibold tabular-nums">
          {day.absent ? t('absent') : day.minutes === null ? t('waiting') : t('hours', { hours: formatDuration(day.minutes) })}
        </p>
      </div>
      <p className="text-muted-foreground">{day.tours.map((tour) => tour.groupName).join(' / ')}</p>
      {!day.absent && (
        <p className="text-muted-foreground tabular-nums">
          {t('span', { start: day.start ?? '—', end: day.end ?? '—' })}
          {day.breakMinutes > 0 && ` · ${t('break', { minutes: day.breakMinutes })}`}
        </p>
      )}
      {openFlag ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t('beingChecked')}</p>
      ) : open ? (
        <form onSubmit={submit} className="mt-2 space-y-2">
          <Textarea
            aria-label={t('noteLabel')}
            placeholder={t('notePlaceholder')}
            value={note}
            required
            maxLength={1000}
            disabled={sending}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <p className="text-xs text-destructive">{t('sendError')}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={sending || !note.trim()}>{t('send')}</Button>
            <Button type="button" size="sm" variant="ghost" disabled={sending} onClick={() => setOpen(false)}>{t('cancel')}</Button>
          </div>
        </form>
      ) : (
        <button type="button" className="mt-2 text-xs text-muted-foreground underline hover:text-foreground" onClick={() => setOpen(true)}>
          {t('report')}
        </button>
      )}
    </li>
  )
}

export function WorkingHours() {
  const t = useTranslations('workingHours')
  const thisMonth = getTodayJst().slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const [data, setData] = useState<MyAttendanceResponse | null>(null)
  const [error, setError] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let current = true
    apiClient
      .getMyAttendance(month)
      .then((result) => {
        if (!current) return
        setData(result)
        setError(false)
      })
      .catch(() => current && setError(true))
    return () => { current = false }
  }, [month, version])

  const total = data?.days.reduce((sum, d) => sum + (d.minutes ?? 0), 0) ?? 0

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-base font-semibold">{t('title')}</h2>
      <div className="mb-3 flex items-center gap-2">
        <Button size="sm" variant="outline" aria-label={t('previousMonth')} onClick={() => setMonth(shiftMonth(month, -1))}>←</Button>
        <span className="min-w-20 text-center font-medium tabular-nums">{formatMonth(month)}</span>
        <Button size="sm" variant="outline" aria-label={t('nextMonth')} disabled={month >= thisMonth} onClick={() => setMonth(shiftMonth(month, 1))}>→</Button>
        {data && data.days.length > 0 && (
          <span className="ml-auto text-sm text-muted-foreground">{t('total', { hours: formatDuration(total) })}</span>
        )}
      </div>
      {error ? (
        <p className="text-sm text-destructive">{t('loadError')}</p>
      ) : data && (data.days.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('none')}</p>
      ) : (
        <ul className="space-y-2">
          {data.days.map((day) => (
            <DayRow key={day.date} day={day} onFlagged={() => setVersion((v) => v + 1)} />
          ))}
        </ul>
      ))}
    </section>
  )
}
