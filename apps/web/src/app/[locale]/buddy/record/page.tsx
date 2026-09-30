'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { apiClient } from '@/lib/api-client'
import { useMyBookings } from '@/hooks/use-my-bookings'
import { AppShell } from '@/components/app-shell'
import { MarkdownText } from '@/components/markdown-text'
import { Button } from '@/components/ui/button'
import type { TourReflectionResponse } from '@peace-buddy/types'
import { getTodayJst } from '@peace-buddy/types'
import { formatDate } from '@/lib/format-date'
import { momentLocation, placeName, placeNames } from '@/lib/place-names'
import { buildRecord, type BuddyRecord, type Milestone } from './buddy.record'

// Long lists open with this many rows; "Show all" expands them in place.
const FIRST_ROWS = 5

// Mobile first (PRD §11.9): one column, every figure number first with its
// label right beside it, and every link a whole row at least 44px tall.

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 id={id} className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="-mx-2 flex min-h-11 items-center gap-2 rounded-md px-2 py-2 hover:bg-accent">
      <span className="min-w-0 flex-1">{children}</span>
      <span aria-hidden className="shrink-0 text-muted-foreground">›</span>
    </Link>
  )
}

function Quote({ children }: { children: string }) {
  return (
    <blockquote className="border-l-4 border-primary/60 pl-3 text-sm">
      <MarkdownText>{children}</MarkdownText>
    </blockquote>
  )
}

function useShowAll<T>(items: T[]) {
  const [all, setAll] = useState(false)
  return { shown: all ? items : items.slice(0, FIRST_ROWS), more: !all && items.length > FIRST_ROWS, showAll: () => setAll(true) }
}

function LastTourCard({ record, locale }: { record: BuddyRecord; locale: string }) {
  const t = useTranslations('buddyRecord')
  const { entry, groupVisit, placeVisits, didWell, canReflect } = record.lastTour
  const places = placeVisits.map((p) => p.place)
  return (
    <Section id="record-last" title={t('last.title')}>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm text-muted-foreground">{formatDate(entry.tourDate)}</p>
        <p className="text-lg font-semibold">{entry.group.name}</p>
        <p className="text-sm text-muted-foreground">{placeNames(places, locale)}</p>
      </div>
      <ul className="flex flex-wrap gap-2 text-sm">
        <li className="rounded-full bg-accent px-3 py-1">{t('last.groupVisit', { count: groupVisit })}</li>
        {placeVisits.map((p) => (
          <li key={p.place.id} className="rounded-full bg-accent px-3 py-1">
            {t('last.placeVisit', { place: placeName(p.place, locale), count: p.tours })}
          </li>
        ))}
      </ul>
      {didWell && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">{t('last.didWell')}</p>
          <Quote>{didWell}</Quote>
        </div>
      )}
      {canReflect && (
        <Button asChild className="min-h-11">
          <Link href={routes.buddyTourReflection(locale, entry.tourId)}>{t('last.write')}</Link>
        </Button>
      )}
    </Section>
  )
}

function MilestoneText({ milestone, locale }: { milestone: Milestone; locale: string }) {
  const t = useTranslations('buddyRecord')
  switch (milestone.kind) {
    case 'firstTour':
      return <>{t('milestones.firstTour')}</>
    case 'nthTour':
      return <>{t('milestones.nthTour', { count: milestone.count })}</>
    case 'firstPlace':
      return <>{t('milestones.firstPlace', { place: placeName(milestone.place, locale) })}</>
    case 'groupAgain':
      return <>{t('milestones.groupAgain', { group: milestone.groupName })}</>
  }
}

function Milestones({ record, locale }: { record: BuddyRecord; locale: string }) {
  const t = useTranslations('buddyRecord')
  const { shown, more, showAll } = useShowAll(record.milestones)
  return (
    <Section id="record-milestones" title={t('milestones.title')}>
      <ol className="flex flex-col">
        {shown.map((m, i) => (
          <li key={`${m.kind}-${m.tourId}-${i}`} className="relative flex gap-3 pb-3 pl-5 last:pb-0">
            <span aria-hidden className="absolute left-0 top-1.5 size-2.5 rounded-full bg-primary" />
            {i < shown.length - 1 && <span aria-hidden className="absolute left-[4px] top-4 h-full w-0.5 bg-border" />}
            <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">{formatDate(m.date)}</span>
            <span className="min-w-0 text-sm font-medium"><MilestoneText milestone={m} locale={locale} /></span>
          </li>
        ))}
      </ol>
      {more && <Button variant="outline" className="min-h-11" onClick={showAll}>{t('showAll')}</Button>}
    </Section>
  )
}

function OpenQuestions({ record, locale }: { record: BuddyRecord; locale: string }) {
  const t = useTranslations('buddyRecord')
  const { shown, more, showAll } = useShowAll(record.openQuestions)
  return (
    <Section id="record-questions" title={t('questions.title', { count: record.openQuestions.length })}>
      {record.openQuestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('questions.none')}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {shown.map((q) => (
            <li key={q.reflectionId}>
              <RowLink href={routes.buddyTourReflection(locale, q.tourId)}>
                <MarkdownText className="text-sm">{q.text}</MarkdownText>
                <span className="mt-1 block text-xs text-muted-foreground">{formatDate(q.tourDate)} · {q.groupName}</span>
              </RowLink>
            </li>
          ))}
        </ul>
      )}
      {more && <Button variant="outline" className="min-h-11" onClick={showAll}>{t('showAll')}</Button>}
    </Section>
  )
}

function Moments({ record, locale }: { record: BuddyRecord; locale: string }) {
  const t = useTranslations('buddyRecord')
  const { shown, more, showAll } = useShowAll(record.moments)
  if (record.moments.length === 0) return null
  return (
    <Section id="record-moments" title={t('moments.title')}>
      <ul className="flex flex-col divide-y">
        {shown.map(({ moment, tourId, tourDate, groupName }) => (
          <li key={moment.id}>
            <RowLink href={routes.buddyTourReflection(locale, tourId)}>
              <span className="block text-xs font-medium text-primary">{momentLocation(moment, locale)}</span>
              <MarkdownText className="text-sm">{moment.description}</MarkdownText>
              <span className="mt-1 block text-xs text-muted-foreground">{formatDate(tourDate)} · {groupName}</span>
            </RowLink>
          </li>
        ))}
      </ul>
      {more && <Button variant="outline" className="min-h-11" onClick={showAll}>{t('showAll')}</Button>}
    </Section>
  )
}

function CountList({ label, items }: { label: string; items: { id: string; label: string; value: number }[] }) {
  const t = useTranslations('buddyRecord')
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {items.map((item) => (
          <li key={item.id} className="flex items-baseline gap-3">
            <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{t('count', { count: item.value })}</span>
            <span className="min-w-0">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Totals({ record, locale }: { record: BuddyRecord; locale: string }) {
  const t = useTranslations('buddyRecord')
  return (
    <Section id="record-totals" title={t('totals.title')}>
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        <li className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums">{record.tours}</span>
          <span className="text-sm text-muted-foreground">{t('totals.tours', { count: record.tours })}</span>
        </li>
        <li className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums">{record.groups}</span>
          <span className="text-sm text-muted-foreground">{t('totals.groups', { count: record.groups })}</span>
        </li>
        <li className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums">{t('totals.hoursValue', { hours: (record.minutesOnTour / 60).toFixed(1) })}</span>
          <span className="text-sm text-muted-foreground">{t('totals.hours')}</span>
        </li>
      </ul>
      {record.sessionsWithoutTimes > 0 && (
        <p className="text-xs text-muted-foreground">{t('totals.withoutTimes', { count: record.sessionsWithoutTimes })}</p>
      )}
      <CountList
        label={t('totals.places')}
        items={record.places.map((p) => ({ id: p.place.id, label: placeName(p.place, locale), value: p.tours }))}
      />
      <CountList
        label={t('totals.groupList')}
        items={record.perGroup.map((g) => ({ id: g.name, label: g.name, value: g.tours }))}
      />
    </Section>
  )
}

export default function BuddyRecordPage() {
  const { firebaseUser, loading } = useAuth()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('buddyRecord')
  const ready = !loading && !!firebaseUser
  const { bookings, error: bookingsError } = useMyBookings(ready)
  const [reflections, setReflections] = useState<TourReflectionResponse[] | null>(null)
  const [reflectionsError, setReflectionsError] = useState(false)

  useEffect(() => {
    if (!ready) return
    apiClient.listMyReflections()
      .then(setReflections)
      .catch(() => setReflectionsError(true))
  }, [ready])

  if (loading) return null

  const failed = bookingsError || reflectionsError
  const record = bookings && reflections ? buildRecord(bookings, reflections, getTodayJst()) : null

  return (
    <AppShell variant="buddy">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-4">
          <Link href={routes.buddy(locale)} className="text-sm text-muted-foreground hover:text-foreground">
            ← {t('back')}
          </Link>
        </div>

        <h1 className="mb-4 text-xl font-semibold">{t('title')}</h1>

        {failed ? (
          <p role="alert" className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{t('loadError')}</p>
        ) : !bookings || !reflections ? null : !record ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <LastTourCard record={record} locale={locale} />
            <Milestones record={record} locale={locale} />
            <OpenQuestions record={record} locale={locale} />
            <Moments record={record} locale={locale} />
            <Totals record={record} locale={locale} />
          </div>
        )}
      </div>
    </AppShell>
  )
}
