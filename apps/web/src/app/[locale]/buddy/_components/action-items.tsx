'use client'

import { useId } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { routes } from '@/lib/routes'
import type { ActionItem } from '../buddy.home'

function useActionLabel() {
  const t = useTranslations('home')
  return (item: ActionItem): string => {
    switch (item.kind) {
      case 'maybe': {
        const deadline = item.entry.maybeDeadline
        if (deadline === null) return t('actions.maybeNoDeadline')
        const date = deadline.slice(0, 10)
        return item.deadlinePassed ? t('actions.maybeOverdue', { date }) : t('actions.maybeBy', { date })
      }
      case 'selfEvaluation':
        return t('actions.selfEvaluation')
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

  return (
    <section aria-labelledby={headingId} className="mb-8">
      <h2 id={headingId} className="mb-3 text-base font-semibold">{t('actions.title')}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('actions.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={`${item.kind}-${item.entry.tourId}`}>
              <Link
                href={routes.buddyTour(locale, item.entry.tourId)}
                className="block rounded-md border bg-card p-3 text-sm hover:bg-accent transition-colors"
              >
                <p className="font-medium">{label(item)}</p>
                <p className="text-muted-foreground">
                  {item.entry.group.name} · {item.entry.tourDate.slice(0, 10)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
