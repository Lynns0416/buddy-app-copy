'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AdminTourBookingEntry, CancellationCategory } from '@peace-buddy/types'
import { Badge } from '@/components/ui/badge'
import { SortIcon } from '@/components/sort-icon'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { sortBookings, nextBookingSort, updateCancellationReason, type BookingSortField } from '../admin.tour'
import { getBookingStatusLabel } from '@/lib/status-display'
import type { BookingStatus } from '@peace-buddy/types'

const BOOKING_STATUS_CLASS: Record<BookingStatus, string> = {
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  maybe: 'bg-amber-100 text-amber-800 border-amber-200',
  waitlist: 'bg-blue-100 text-blue-800 border-blue-200',
  declined: 'bg-slate-100 text-slate-700 border-slate-200',
}

interface Props {
  bookings: AdminTourBookingEntry[]
  totalSessions: number
}

export function TourBookingsTable({ bookings: initialBookings, totalSessions }: Props) {
  const t = useTranslations('adminTours')
  const tBookingStatus = useTranslations('bookingStatus')
  const [bookings, setBookings] = useState(initialBookings)
  const [sortField, setSortField] = useState<BookingSortField>('bookedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [updatingReason, setUpdatingReason] = useState<string | null>(null)

  function handleSort(field: BookingSortField) {
    const next = nextBookingSort({ field: sortField, dir: sortDir }, field)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  async function handleUnavoidableChange(bookingId: string, value: boolean) {
    setUpdatingReason(bookingId)
    const result = await updateCancellationReason(bookingId, value)
    if (result.ok) {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId && b.cancellationReason
            ? { ...b, cancellationReason: { ...b.cancellationReason, unavoidable: result.data.unavoidable } }
            : b,
        ),
      )
    }
    setUpdatingReason(null)
  }

  const cancelCategoryLabel: Record<CancellationCategory, string> = {
    health: t('cancelCategory.health'),
    emergency: t('cancelCategory.emergency'),
    personal: t('cancelCategory.personal'),
    work: t('cancelCategory.work'),
    other: t('cancelCategory.other'),
  }

  const sorted = sortBookings(bookings, sortField, sortDir)

  if (bookings.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noBookings')}</p>
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button
                className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                onClick={() => handleSort('displayName')}
              >
                {t('buddyName')}
                <SortIcon active={sortField === 'displayName'} dir={sortDir} />
              </button>
            </TableHead>
            {totalSessions > 1 && <TableHead>{t('bookingSession')}</TableHead>}
            <TableHead>
              <button
                className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                onClick={() => handleSort('status')}
              >
                {t('bookingStatus')}
                <SortIcon active={sortField === 'status'} dir={sortDir} />
              </button>
            </TableHead>
            <TableHead>
              <button
                className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                onClick={() => handleSort('bookedAt')}
              >
                {t('bookedAt')}
                <SortIcon active={sortField === 'bookedAt'} dir={sortDir} />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((b) => (
            <>
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.displayName}</TableCell>
                {totalSessions > 1 && (
                  <TableCell className="text-sm text-muted-foreground">
                    {b.sessionLabel ?? t(`session.defaultLabel.${b.sessionOrder}`)}
                  </TableCell>
                )}
                <TableCell>
                  <Badge className={BOOKING_STATUS_CLASS[b.status]}>
                    {getBookingStatusLabel(tBookingStatus, b.status)}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums text-sm text-muted-foreground">
                  {new Date(b.bookedAt).toLocaleString()}
                </TableCell>
              </TableRow>
              {b.cancellationReason && (
                <TableRow key={`${b.id}-reason`} className="bg-muted/30">
                  <TableCell colSpan={totalSessions > 1 ? 4 : 3} className="py-2 text-xs text-muted-foreground">
                    <div className="flex flex-col gap-1">
                      <span>
                        <span className="font-medium">{t('cancellationReason')}:</span>{' '}
                        {cancelCategoryLabel[b.cancellationReason.category]}
                        {b.cancellationReason.freeText && ` — ${b.cancellationReason.freeText}`}
                      </span>
                      <span className="inline-flex gap-3">
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            className="h-3.5 w-3.5"
                            checked={b.cancellationReason.unavoidable === true}
                            disabled={updatingReason === b.id}
                            onChange={() => void handleUnavoidableChange(b.id, true)}
                          />
                          {t('unavoidable')}
                        </label>
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            className="h-3.5 w-3.5"
                            checked={b.cancellationReason.unavoidable !== true}
                            disabled={updatingReason === b.id}
                            onChange={() => void handleUnavoidableChange(b.id, false)}
                          />
                          {t('avoidable')}
                        </label>
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
