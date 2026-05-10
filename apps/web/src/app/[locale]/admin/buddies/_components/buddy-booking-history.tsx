'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import type { AdminBuddyBookingEntry } from '@peace-buddy/types'
import { SortIcon } from '@/components/sort-icon'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { routes } from '@/lib/routes'
import { sortBookingHistory, nextBookingSort, updateCancellationReason, type BookingHistorySortField } from '../admin.buddy'
import { getBookingStatusLabel } from '@/lib/status-display'

interface BuddyBookingHistoryProps {
  bookings: AdminBuddyBookingEntry[]
}

export function BuddyBookingHistory({ bookings: initialBookings }: BuddyBookingHistoryProps) {
  const t = useTranslations('adminBuddies')
  const tBookingStatus = useTranslations('bookingStatus')
  const locale = useLocale()
  const [bookings, setBookings] = useState(initialBookings)
  const [sortField, setSortField] = useState<BookingHistorySortField>('tourDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [updatingReason, setUpdatingReason] = useState<string | null>(null)

  function handleSort(field: BookingHistorySortField) {
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

  const sorted = sortBookingHistory(bookings, sortField, sortDir)

  const reasons = bookings
    .map((b) => b.cancellationReason)
    .filter((cr): cr is NonNullable<typeof cr> => cr !== null)
  const cancellationSummary = {
    total: reasons.length,
    unavoidable: reasons.filter((cr) => cr.unavoidable === true).length,
    avoidable: reasons.filter((cr) => cr.unavoidable === false).length,
    unreviewed: reasons.filter((cr) => cr.unavoidable === null).length,
  }

  if (bookings.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('bookingHistoryEmpty')}</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {cancellationSummary.total > 0 && (
        <p className="text-sm text-muted-foreground">
          {t('cancellationSummary', {
            total: cancellationSummary.total,
            unavoidable: cancellationSummary.unavoidable,
            avoidable: cancellationSummary.avoidable,
          })}
        </p>
      )}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                  onClick={() => handleSort('group')}
                >
                  {t('bookingHistoryGroup')}
                  <SortIcon active={sortField === 'group'} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                  onClick={() => handleSort('tourDate')}
                >
                  {t('bookingHistoryTourDate')}
                  <SortIcon active={sortField === 'tourDate'} dir={sortDir} />
                </button>
              </TableHead>
              <TableHead>{t('bookingHistoryLocation')}</TableHead>
              <TableHead>
                <button
                  className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                  onClick={() => handleSort('status')}
                >
                  {t('bookingHistoryStatus')}
                  <SortIcon active={sortField === 'status'} dir={sortDir} />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((booking) => (
              <>
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={routes.adminTourDetail(locale, booking.tourId)}
                      className="text-primary hover:underline"
                    >
                      {booking.tour.group.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {booking.tour.tourDate.slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{booking.tour.location}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {getBookingStatusLabel(tBookingStatus, booking.status)}
                  </TableCell>
                </TableRow>
                {booking.cancellationReason && (
                  <TableRow key={`${booking.id}-reason`} className="bg-muted/30">
                    <TableCell colSpan={4} className="py-2 text-xs text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        <span>
                          <span className="font-medium">{t('bookingHistoryCancellationReason')}:</span>{' '}
                          {t(`cancelCategory.${booking.cancellationReason.category}`)}
                          {booking.cancellationReason.freeText && ` — ${booking.cancellationReason.freeText}`}
                        </span>
                        <span className="inline-flex gap-3">
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              className="h-3.5 w-3.5"
                              checked={booking.cancellationReason.unavoidable === true}
                              disabled={updatingReason === booking.id}
                              onChange={() => void handleUnavoidableChange(booking.id, true)}
                            />
                            {t('unavoidable')}
                          </label>
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              className="h-3.5 w-3.5"
                              checked={booking.cancellationReason.unavoidable !== true}
                              disabled={updatingReason === booking.id}
                              onChange={() => void handleUnavoidableChange(booking.id, false)}
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
    </div>
  )
}
