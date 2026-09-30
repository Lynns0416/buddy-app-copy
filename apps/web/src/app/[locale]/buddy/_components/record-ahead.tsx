'use client'

import { useId } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { routes } from '@/lib/routes'
import { formatDate } from '@/lib/format-date'
import { MarkdownText } from '@/components/markdown-text'
import { nextTourMilestone, type BuddyRecord } from '../record/buddy.record'

// The forward-looking part of the buddy record, for a buddy who has toured:
// the note carried to the next tour and the next milestone. The rest of the
// record stays on /buddy/record (PRD §11.9).
export function RecordAhead({ record }: { record: BuddyRecord }) {
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('home')
  const tRecord = useTranslations('buddyRecord')
  const headingId = useId()
  const note = record.nextTourNote
  const milestone = nextTourMilestone(record.tours)

  return (
    <section aria-labelledby={headingId} className="mb-8 flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 id={headingId} className="text-base font-semibold">{t('record.title')}</h2>
      {note && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">{tRecord('note.from', { date: formatDate(note.fromTourDate) })}</p>
          <blockquote className="border-l-4 border-primary/60 pl-3 text-sm">
            <MarkdownText>{note.couldImprove}</MarkdownText>
          </blockquote>
        </div>
      )}
      <p className="text-sm font-medium">{t('record.milestone', milestone)}</p>
      <Link href={routes.buddyRecord(locale)} className="text-sm font-medium text-primary hover:underline">
        {t('record.link')}
      </Link>
    </section>
  )
}
