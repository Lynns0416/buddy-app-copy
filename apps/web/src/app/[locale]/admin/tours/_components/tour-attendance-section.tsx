'use client'

import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import type { AppError, AttendanceBreak, LateReason, TourAttendanceResponse, TourAttendanceRow, UpdateAttendance } from '@peace-buddy/types'
import { AppErrorCodeSchema, AttendanceChangeKindSchema, LateReasonSchema } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SortIcon } from '@/components/sort-icon'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/format-date'
import { formatDuration, nextSort, sortSheet, toUpdate, type SheetSortField } from '@/lib/attendance'
import { fetchTourAttendance, saveAttendance, saveBreak, saveFinishTime } from '../../attendance/admin.attendance'

// PRD §11.10: the finish time of the day and the tour's unpaid break, then one
// row per confirmed buddy. Start and End open an editor; empty means "follows
// the default".

type EditorMode = 'start' | 'end'
type BreakMode = 'none' | 'times' | 'minutes'

const exceptionCell = 'bg-amber-50 dark:bg-amber-950/40'

function useErrorMessage() {
  const t = useTranslations('adminAttendance')
  return (error: AppError): string => {
    switch (error.code) {
      case AppErrorCodeSchema.enum.invalid_request: return t('error.invalid')
      case AppErrorCodeSchema.enum.conflict:        return t('error.conflict')
      case AppErrorCodeSchema.enum.not_found:       return t('error.notFound')
      case AppErrorCodeSchema.enum.network:         return t('error.network')
      default:                                      return t('error.unknown')
    }
  }
}

function StartCell({ row }: { row: TourAttendanceRow }) {
  const t = useTranslations('adminAttendance')
  if (row.absent) {
    return <span className="font-medium text-destructive">{t(row.absenceReported ? 'absentReported' : 'absentUnreported')}</span>
  }
  if (row.lateMinutes > 0 && row.arrivalTime) {
    return (
      <span>
        <span className="font-medium">{t('late', { time: row.arrivalTime, minutes: row.lateMinutes })}</span>
        <span className="block text-xs text-muted-foreground">
          {row.lateReason ? t(`lateReason.${row.lateReason}`) : ''}
          {row.lateNote ? ` · ${row.lateNote}` : ''}
          {row.lateExcused !== null ? ` · ${t(row.lateExcused ? 'excused' : 'notExcused')}` : ''}
        </span>
      </span>
    )
  }
  if (row.arrivalTime) return <span className="font-medium tabular-nums">{row.arrivalTime}</span>
  return <span className="text-muted-foreground">{t('onTime', { time: row.defaultArrival })}</span>
}

function EndCell({ row }: { row: TourAttendanceRow }) {
  const t = useTranslations('adminAttendance')
  if (row.absent) return <span className="text-muted-foreground">—</span>
  const breakLine = row.breakMinutes > 0 ? (
    <span className="block text-xs text-muted-foreground">{t('breakMinutes', { minutes: row.breakMinutes })}</span>
  ) : null
  if (row.leaveTime) {
    return (
      <span>
        <span className="font-medium tabular-nums">
          {row.earlyMinutes ? t('leftEarly', { time: row.leaveTime }) : row.leaveTime}
        </span>
        {row.leaveNote && <span className="block text-xs text-muted-foreground">{row.leaveNote}</span>}
        {breakLine}
      </span>
    )
  }
  return (
    <span>
      <span className="text-muted-foreground">{t('finish')}</span>
      {breakLine}
    </span>
  )
}

function isStartException(row: TourAttendanceRow): boolean {
  return row.absent || row.lateMinutes > 0 || row.arrivalTime !== null
}

function isEndException(row: TourAttendanceRow): boolean {
  return !row.absent && row.leaveTime !== null
}

function StartEditor({ row, saving, onSave, onCancel }: {
  row: TourAttendanceRow
  saving: boolean
  onSave: (data: UpdateAttendance) => void
  onCancel: () => void
}) {
  const t = useTranslations('adminAttendance')
  const [absent, setAbsent] = useState(row.absent)
  const [reported, setReported] = useState<boolean>(row.absenceReported ?? false)
  const [arrival, setArrival] = useState(row.arrivalTime ?? row.defaultArrival)
  const [reason, setReason] = useState<LateReason>(row.lateReason ?? LateReasonSchema.enum.transport_delay)
  const [note, setNote] = useState(row.lateNote ?? '')
  const [excused, setExcused] = useState<boolean | null>(row.lateExcused)
  const late = !absent && arrival > row.defaultArrival

  function submit(e: FormEvent) {
    e.preventDefault()
    const base = toUpdate(row)
    if (absent) {
      onSave({ ...base, absent: true, absenceReported: reported, arrivalTime: null, lateReason: null, lateNote: null, lateExcused: null, leaveTime: null, leaveNote: null })
      return
    }
    onSave({
      ...base,
      absent: false,
      absenceReported: null,
      arrivalTime: arrival,
      lateReason: late ? reason : null,
      lateNote: late ? note.trim() || null : null,
      lateExcused: late ? excused : null,
    })
  }

  function backToDefault() {
    onSave({ ...toUpdate(row), absent: false, absenceReported: null, arrivalTime: null, lateReason: null, lateNote: null, lateExcused: null })
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-sm" aria-label={t('editStart')}>
      <label className="flex items-center gap-2">
        <input type="checkbox" className="h-4 w-4" checked={absent} disabled={saving} onChange={(e) => setAbsent(e.target.checked)} />
        {t('absent')}
      </label>
      {absent ? (
        <fieldset className="flex gap-4">
          <legend className="sr-only">{t('absent')}</legend>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="reported" checked={reported} disabled={saving} onChange={() => setReported(true)} />
            {t('reported')}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="reported" checked={!reported} disabled={saving} onChange={() => setReported(false)} />
            {t('notReported')}
          </label>
        </fieldset>
      ) : (
        <>
          <label className="flex items-center gap-2">
            <span className="w-28 text-muted-foreground">{t('arrival')}</span>
            <Input type="time" className="w-32" value={arrival} disabled={saving} required onChange={(e) => setArrival(e.target.value)} />
            <span className="text-xs text-muted-foreground">{t('defaultStart', { time: row.defaultArrival })}</span>
          </label>
          {late && (
            <>
              <label className="flex items-center gap-2">
                <span className="w-28 text-muted-foreground">{t('reason')}</span>
                <select
                  className="h-9 rounded-md border bg-background px-2"
                  value={reason}
                  disabled={saving}
                  onChange={(e) => setReason(LateReasonSchema.parse(e.target.value))}
                >
                  {LateReasonSchema.options.map((r) => (
                    <option key={r} value={r}>{t(`lateReason.${r}`)}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-28 text-muted-foreground">{t('note')}</span>
                <Input
                  className="max-w-sm"
                  value={note}
                  disabled={saving}
                  required={reason === LateReasonSchema.enum.other}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <fieldset className="flex items-center gap-4">
                <legend className="float-left w-28 text-muted-foreground">{t('excusedQuestion')}</legend>
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="excused" required checked={excused === true} disabled={saving} onChange={() => setExcused(true)} />
                  {t('yes')}
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="excused" checked={excused === false} disabled={saving} onChange={() => setExcused(false)} />
                  {t('no')}
                </label>
              </fieldset>
            </>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={saving}>{t('save')}</Button>
        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={backToDefault}>{t('backToDefault')}</Button>
        <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </form>
  )
}

function EndEditor({ row, finishTime, saving, onSave, onCancel }: {
  row: TourAttendanceRow
  finishTime: string | null
  saving: boolean
  onSave: (data: UpdateAttendance) => void
  onCancel: () => void
}) {
  const t = useTranslations('adminAttendance')
  const [leave, setLeave] = useState(row.leaveTime ?? '')
  const [note, setNote] = useState(row.leaveNote ?? '')

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({ ...toUpdate(row), leaveTime: leave || null, leaveNote: leave ? note.trim() || null : null })
  }

  function backToDefault() {
    onSave({ ...toUpdate(row), leaveTime: null, leaveNote: null })
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-sm" aria-label={t('editEnd')}>
      <label className="flex items-center gap-2">
        <span className="w-28 text-muted-foreground">{t('leave')}</span>
        <Input type="time" className="w-32" value={leave} disabled={saving} onChange={(e) => setLeave(e.target.value)} />
        <span className="text-xs text-muted-foreground">
          {finishTime ? t('defaultEnd', { time: finishTime }) : t('noFinishTime')}
        </span>
      </label>
      {leave && (
        <label className="flex items-center gap-2">
          <span className="w-28 text-muted-foreground">{t('note')}</span>
          <Input className="max-w-sm" value={note} disabled={saving} onChange={(e) => setNote(e.target.value)} />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={saving}>{t('save')}</Button>
        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={backToDefault}>{t('backToDefault')}</Button>
        <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </form>
  )
}

// The tour's unpaid break, taken by everyone on it together. Each buddy loses
// only the part that falls inside their own start → end.
function BreakForm({ current, editable, saving, onSave }: {
  current: TourAttendanceResponse['break']
  editable: boolean
  saving: boolean
  onSave: (data: AttendanceBreak | null) => void
}) {
  const t = useTranslations('adminAttendance')
  const [mode, setMode] = useState<BreakMode>(current ? (current.start && current.end ? 'times' : 'minutes') : 'none')
  const [start, setStart] = useState(current?.start ?? '')
  const [end, setEnd] = useState(current?.end ?? '')
  const [minutes, setMinutes] = useState(current ? String(current.minutes) : '')
  const disabled = !editable || saving

  function submit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'times') onSave({ start, end })
    else if (mode === 'minutes') onSave({ minutes: Number(minutes) })
    else onSave(null)
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-4 text-sm" aria-label={t('unpaidBreak')}>
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <legend className="float-left mr-2 font-medium">{t('unpaidBreak')}</legend>
        {(['none', 'times', 'minutes'] as const).map((m) => (
          <label key={m} className="flex items-center gap-1.5">
            <input type="radio" name="breakMode" checked={mode === m} disabled={disabled} onChange={() => setMode(m)} />
            {t(`breakMode.${m}`)}
          </label>
        ))}
      </fieldset>
      {mode === 'times' && (
        <div className="flex items-center gap-2">
          <Input type="time" className="w-32" aria-label={t('breakStart')} value={start} required disabled={disabled} onChange={(e) => setStart(e.target.value)} />
          <span>–</span>
          <Input type="time" className="w-32" aria-label={t('breakEnd')} value={end} required disabled={disabled} onChange={(e) => setEnd(e.target.value)} />
        </div>
      )}
      {mode === 'minutes' && (
        <label className="flex items-center gap-2">
          <Input type="number" min={1} max={720} className="w-24" aria-label={t('breakMinutesLabel')} value={minutes} required disabled={disabled} onChange={(e) => setMinutes(e.target.value)} />
          <span className="text-muted-foreground">{t('minutesUnit')}</span>
        </label>
      )}
      {editable && <Button type="submit" size="sm" disabled={saving}>{t('save')}</Button>}
    </form>
  )
}

export function TourAttendanceSection({ tourId }: { tourId: string }) {
  const t = useTranslations('adminAttendance')
  const errorMessage = useErrorMessage()
  const [sheet, setSheet] = useState<TourAttendanceResponse | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [finish, setFinish] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<{ buddyId: string; mode: EditorMode } | null>(null)
  const [sortField, setSortField] = useState<SheetSortField>('buddy')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function load(next: TourAttendanceResponse) {
    setSheet(next)
    setFinish(next.finishTime ?? '')
  }

  useEffect(() => {
    fetchTourAttendance(tourId).then((result) => {
      if (result.ok) load(result.data)
      else setError(result.error)
    })
  }, [tourId])

  async function refresh() {
    const result = await fetchTourAttendance(tourId)
    if (result.ok) load(result.data)
  }

  async function handleFinish(e: FormEvent) {
    e.preventDefault()
    if (!sheet || !finish) return
    setSaving(true)
    setError(null)
    const result = await saveFinishTime(sheet.date, finish)
    if (result.ok) await refresh()
    else setError(result.error)
    setSaving(false)
  }

  async function handleSave(buddyId: string, data: UpdateAttendance) {
    setSaving(true)
    setError(null)
    const result = await saveAttendance(tourId, buddyId, data)
    if (result.ok) {
      load(result.data)
      setEditing(null)
    } else {
      setError(result.error)
    }
    setSaving(false)
  }

  async function handleBreak(data: AttendanceBreak | null) {
    setSaving(true)
    setError(null)
    const result = await saveBreak(tourId, { break: data })
    if (result.ok) load(result.data)
    else setError(result.error)
    setSaving(false)
  }

  function handleSort(field: SheetSortField) {
    const next = nextSort({ field: sortField, dir: sortDir }, field)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  if (!sheet) {
    return error ? <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{errorMessage(error)}</p> : null
  }

  const rows = sortSheet(sheet.rows, sortField, sortDir)
  const header = (field: SheetSortField, label: string) => (
    <TableHead>
      <button className="inline-flex items-center font-medium transition-colors hover:text-foreground" onClick={() => handleSort(field)}>
        {label}
        <SortIcon active={sortField === field} dir={sortDir} />
      </button>
    </TableHead>
  )
  const cellButton = (row: TourAttendanceRow, mode: EditorMode, content: ReactNode) =>
    sheet.editable ? (
      <button
        type="button"
        className="w-full rounded px-1 py-0.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={editing?.buddyId === row.buddyId && editing.mode === mode}
        aria-label={t(mode === 'start' ? 'editStartFor' : 'editEndFor', { name: row.displayName })}
        onClick={() => setEditing(editing?.buddyId === row.buddyId && editing.mode === mode ? null : { buddyId: row.buddyId, mode })}
      >
        {content}
      </button>
    ) : (
      content
    )

  return (
    <div className="space-y-4">
      {sheet.locked && <p className="text-sm text-muted-foreground">{t('lockedNotice')}</p>}

      <form onSubmit={handleFinish} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4 text-sm">
        <label htmlFor="attendance-finish" className="font-medium">{t('finishTime')}</label>
        <Input
          id="attendance-finish"
          type="time"
          className="w-32"
          value={finish}
          disabled={!sheet.editable || saving}
          required
          onChange={(e) => setFinish(e.target.value)}
        />
        {sheet.editable && (
          <Button type="submit" size="sm" disabled={saving || !finish || finish === sheet.finishTime}>{t('save')}</Button>
        )}
        <span className="text-muted-foreground">
          {sheet.finishTime ? t('followingFinish', { count: sheet.followingFinish }) : t('noFinishTimeYet')}
        </span>
      </form>

      <BreakForm
        // Remounts with what the server holds after each load.
        key={JSON.stringify(sheet.break)}
        current={sheet.break}
        editable={sheet.editable}
        saving={saving}
        onSave={(d) => void handleBreak(d)}
      />

      {error && <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{errorMessage(error)}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noBuddies')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {header('buddy', t('buddy'))}
                {header('start', t('start'))}
                {header('end', t('end'))}
                {header('hours', t('hours'))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <Fragment key={row.buddyId}>
                  <TableRow>
                    <TableCell className="font-medium">{row.displayName}</TableCell>
                    <TableCell className={isStartException(row) ? exceptionCell : undefined}>
                      {cellButton(row, 'start', <StartCell row={row} />)}
                    </TableCell>
                    <TableCell className={isEndException(row) ? exceptionCell : undefined}>
                      {row.absent ? <EndCell row={row} /> : cellButton(row, 'end', <EndCell row={row} />)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.minutes === null ? <span className="text-muted-foreground">{t('waitingForFinish')}</span> : formatDuration(row.minutes)}
                    </TableCell>
                  </TableRow>
                  {editing?.buddyId === row.buddyId && (
                    <TableRow>
                      <TableCell colSpan={4} className="bg-muted/40">
                        {editing.mode === 'start' ? (
                          <StartEditor row={row} saving={saving} onSave={(d) => void handleSave(row.buddyId, d)} onCancel={() => setEditing(null)} />
                        ) : (
                          <EndEditor row={row} finishTime={sheet.finishTime} saving={saving} onSave={(d) => void handleSave(row.buddyId, d)} onCancel={() => setEditing(null)} />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {sheet.changes.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{t('changeLog', { count: sheet.changes.length })}</summary>
          <ul className="mt-2 space-y-1">
            {sheet.changes.map((c) => (
              <li key={c.id} className="text-muted-foreground">
                <span className="tabular-nums">{formatDateTime(c.createdAt)}</span>
                {' · '}{c.changedByName}{' · '}
                {c.kind === AttendanceChangeKindSchema.enum.finish_time
                  ? t('fields.finishTime')
                  : c.kind === AttendanceChangeKindSchema.enum.tour_break
                    ? t('unpaidBreak')
                    : `${c.buddyName ?? '—'}: ${c.fields.map((f) => t(`fields.${f}`)).join(', ')}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
