'use client'

import { useId } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { routes } from '@/lib/routes'
import type { ActionItem } from '../buddy.home'
import { formatDate } from '@/lib/format-date'

function useActionLabel() {
  const t = useTranslations('home')
  return (item: ActionItem): string => {
    switch (item.kind) {
      case 'maybe': {
        const deadline = item.entry.maybeDeadline
        if (deadline === null) return t('actions.maybeNoDeadline')
        const date = formatDate(deadline)
        return item.deadlinePassed ? t('actions.maybeOverdue', { date }) : t('actions.maybeBy', { date })
      }
      case 'reflection':
        return t('actions.reflection')
      case 'waitlist':
        return t('actions.waitlist')
    }
  }
}

export function ActionItems({ items }: { items: ActionItem[] }) {
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('home')
  const label = useActionLabel()
  const headingId = useId()

  // Nothing owed takes no room, so the tours to book stay near the top.
  if (items.length === 0) return null

  return (
    <section aria-labelledby={headingId} className="mb-8">
      <h2 id={headingId} className="mb-3 text-base font-semibold">{t('actions.title')}</h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={`${item.kind}-${item.entry.tourId}`}>
            <Link
              href={
                item.kind === 'reflection'
                  ? routes.buddyTourReflection(locale, item.entry.tourId)
                  : routes.buddyTour(locale, item.entry.tourId)
              }
              className="block rounded-md border bg-card p-3 text-sm hover:bg-accent transition-colors"
            >
              <p className="font-medium">{label(item)}</p>
              <p className="text-muted-foreground">
                {item.entry.group.name} · {formatDate(item.entry.tourDate)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
