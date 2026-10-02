'use client'

import { useId, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Megaphone } from 'lucide-react'
import type { MyAnnouncementResponse } from '@peace-buddy/types'
import { routes } from '@/lib/routes'
import { MarkdownText } from '@/components/markdown-text'
import { ANNOUNCEMENTS_PREVIEW, announcementText } from '../buddy.home'

// お知らせ from PLAB members (#266, PRD §11.1). Nothing to dismiss: each shows
// until its end date, or until its tour no longer needs this buddy.
export function Announcements({ announcements }: { announcements: MyAnnouncementResponse[] }) {
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('home.announcements')
  const [showAll, setShowAll] = useState(false)
  const headingId = useId()

  if (announcements.length === 0) return null

  const visible = showAll ? announcements : announcements.slice(0, ANNOUNCEMENTS_PREVIEW)

  return (
    <section aria-labelledby={headingId} className="mb-8">
      <h2 id={headingId} className="mb-3 text-base font-semibold">{t('title')}</h2>
      <div className="flex flex-col gap-3">
        {visible.map((a) => {
          const { title, body } = announcementText(a, locale)
          return (
            <article key={a.id} className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <h3 className="mb-2 flex items-start gap-2 font-medium">
                <Megaphone size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                {title}
              </h3>
              <MarkdownText className="text-sm">{body}</MarkdownText>
              {a.tourId && (
                <Link
                  href={routes.buddyTour(locale, a.tourId)}
                  className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                >
                  {t('viewTour')}
                </Link>
              )}
            </article>
          )
        })}
      </div>
      {announcements.length > ANNOUNCEMENTS_PREVIEW && (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-sm font-medium text-primary hover:underline"
        >
          {showAll ? t('showFewer') : t('showAll', { count: announcements.length })}
        </button>
      )}
    </section>
  )
}
