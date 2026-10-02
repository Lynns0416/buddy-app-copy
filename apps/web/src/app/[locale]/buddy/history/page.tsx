'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { useMyBookings } from '@/hooks/use-my-bookings'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { SuggestInput } from '@/components/suggest-input'
import type { MyTourBookingEntry } from '@peace-buddy/types'
import { getTodayJst } from '@peace-buddy/types'
import { filterPast, findPastAttended, groupByYear, summarize } from './buddy.history'
import { formatDate } from '@/lib/format-date'
import { placeNames } from '@/lib/place-names'
import { WorkingHours } from './_components/working-hours'

function BookingRow({ entry, viewLabel }: { entry: MyTourBookingEntry; viewLabel: string }) {
  const { locale } = useParams<{ locale: string }>()
  const tBookingStatus = useTranslations('bookingStatus')
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{entry.group.name}</p>
        <p className="text-muted-foreground">{formatDate(entry.tourDate)} · {placeNames(entry.places, locale)}</p>
        <div className="mt-1 flex flex-col gap-0.5">
          {entry.bookings.map((b) => (
            <p key={b.sessionId} className="text-xs text-muted-foreground">
              {b.meetingTime.slice(11, 16)} — {tBookingStatus(b.bookingStatus)}
            </p>
          ))}
        </div>
      </div>
      <Link
        href={routes.buddyTour(locale, entry.tourId)}
        className="shrink-0 text-sm font-medium text-primary hover:underline"
      >
        {viewLabel}
      </Link>
    </div>
  )
}

export default function BuddyHistoryPage() {
  const { firebaseUser, loading } = useAuth()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('history')
  const [unreflectedOnly, setUnreflectedOnly] = useState(false)
  const [groupName, setGroupName] = useState('')

  const { bookings } = useMyBookings(!loading && !!firebaseUser)

  if (loading || (!bookings)) return null

  const today = getTodayJst()
  const past = findPastAttended(bookings, today)
  const summary = summarize(past)
  const unreflectedCount = filterPast(past, { unreflectedOnly: true, groupName: '' }).length
  const years = groupByYear(filterPast(past, { unreflectedOnly, groupName }))

  return (
    <AppShell variant="buddy">
      <div className="mb-6">
        <Link href={routes.buddy(locale)} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('back')}
        </Link>
      </div>

      <h1 className="mb-2 text-xl font-semibold">{t('title')}</h1>
      {summary && (
        <p className="text-sm text-muted-foreground">{t('summary', summary)}</p>
      )}

      <WorkingHours />

      {/* Past tours only: upcoming ones are on Home (#265). */}
      <section className="mt-6">
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noPast')}</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {unreflectedCount > 0 && (
                <Button
                  size="sm"
                  variant={unreflectedOnly ? 'default' : 'outline'}
                  aria-pressed={unreflectedOnly}
                  onClick={() => setUnreflectedOnly((v) => !v)}
                >
                  {t('filterUnreflected', { count: unreflectedCount })}
                </Button>
              )}
              <SuggestInput
                className="w-full sm:w-56"
                suggestions={past.map((e) => e.group.name)}
                aria-label={t('searchGroup')}
                placeholder={t('searchGroup')}
                value={groupName}
                onChange={setGroupName}
              />
            </div>
            {years.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noMatches')}</p>
            ) : (
              <div className="space-y-6">
                {years.map(({ year, entries }) => (
                  <div key={year}>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                      {t('year', { year, count: entries.length })}
                    </h3>
                    <div className="space-y-2">
                      {entries.map((b) => (
                        <BookingRow key={b.tourId} entry={b} viewLabel={t('viewTour')} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </AppShell>
  )
}
