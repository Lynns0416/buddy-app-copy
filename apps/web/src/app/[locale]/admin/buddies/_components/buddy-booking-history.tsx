'use client'

import React, { useState } from 'react'
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
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('cancellationSummaryTitle')}
          </p>
          <div className="flex flex-wrap gap-2">
            {([
              { value: cancellationSummary.total, label: t('cancellationTotal') },
              { value: cancellationSummary.unavoidable, label: t('unavoidable') },
              { value: cancellationSummary.avoidable, label: t('avoidable') },
              { value: cancellationSummary.unreviewed, label: t('unreviewed') },
            ] as const).map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center rounded-md border bg-card px-4 py-2 text-center">
                <span className="text-xl font-semibold leading-none">{value}</span>
                <span className="mt-1 text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Mobile cards */}
      <div className="lg:hidden space-y-2">
        <div className="flex flex-wrap gap-2 mb-1">
          {([
            { field: 'group' as const, label: t('bookingHistoryGroup') },
            { field: 'tourDate' as const, label: t('bookingHistoryTourDate') },
            { field: 'status' as const, label: t('bookingHistoryStatus') },
          ]).map(({ field, label }) => (
            <button
              key={field}
              className="inline-flex items-center gap-0.5 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => handleSort(field)}
            >
              {label}
              <SortIcon active={sortField === field} dir={sortDir} />
            </button>
          ))}
        </div>
        {sorted.map((booking) => (
          <div key={booking.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link
                  href={routes.adminTourDetail(locale, booking.tourId)}
                  className="font-medium text-primary hover:underline"
                >
                  {booking.tour.group.name}
                </Link>
                <p className="tabular-nums text-xs text-muted-foreground">{booking.tour.tourDate.slice(0, 10)}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {getBookingStatusLabel(tBookingStatus, booking.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{booking.tour.location}</p>
            {booking.cancellationReason && (
              <div className="mt-2 rounded-md bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium">{t('bookingHistoryCancellationReason')}:</span>{' '}
                  {t(`cancelCategory.${booking.cancellationReason.category}`)}
                  {booking.cancellationReason.freeText && ` — ${booking.cancellationReason.freeText}`}
                </p>
                <div className="mt-1 flex gap-3">
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
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block rounded-lg border bg-card">
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
              <React.Fragment key={booking.id}>
                <TableRow>
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
                  <TableRow className="bg-muted/30">
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
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
