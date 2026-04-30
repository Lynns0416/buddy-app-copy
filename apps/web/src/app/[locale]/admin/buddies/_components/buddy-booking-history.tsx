'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import type { AdminBuddyBookingEntry } from '@peace-buddy/types'
import { SortIcon } from '@/components/sort-icon'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { routes } from '@/lib/routes'
import { sortBookingHistory, nextBookingSort, type BookingHistorySortField } from '../admin.buddy'
import { getBookingStatusLabel } from '@/lib/status-display'

interface BuddyBookingHistoryProps {
  bookings: AdminBuddyBookingEntry[]
}

export function BuddyBookingHistory({ bookings }: BuddyBookingHistoryProps) {
  const t = useTranslations('adminBuddies')
  const tBookingStatus = useTranslations('bookingStatus')
  const locale = useLocale()
  const [sortField, setSortField] = useState<BookingHistorySortField>('tourDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function handleSort(field: BookingHistorySortField) {
    const next = nextBookingSort({ field: sortField, dir: sortDir }, field)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  const sorted = sortBookingHistory(bookings, sortField, sortDir)

  if (bookings.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('bookingHistoryEmpty')}</p>
  }

  return (
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
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
