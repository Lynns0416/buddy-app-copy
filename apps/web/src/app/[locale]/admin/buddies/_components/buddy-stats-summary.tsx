'use client'

import { ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { AdminBuddyStatsRow } from '@peace-buddy/types'
import { cn } from '@/lib/utils'
import { STAT_GROUPS, buildStatColumns, formatStat, statLabel, type StatColumn } from '../../stats/buddies/admin.buddy-stats'
import { useStatTranslators } from '../../stats/buddies/use-stat-translators'

// Nothing to report reads quieter, so the numbers that say something stand out.
function isEmpty(column: StatColumn, buddy: AdminBuddyStatsRow): boolean {
  const value = column.value(buddy)
  return value === null || value === 0
}

// The headline numbers, in the order an admin reads a buddy: how much they have
// done, whether they turn up, whether they are still active.
const KEY_SECTIONS = [
  { id: 'activity', columns: ['sessionsAttended', 'toursAttended', 'reflections'] },
  { id: 'reliability', columns: ['attendanceRate', 'noShows', 'lateUnexcused', 'lateCancellations'] },
  { id: 'recent', columns: ['lastTourDate', 'daysSinceLastTour', 'upcomingConfirmed'] },
] as const

// The buddy's all-time numbers, from the same columns as the stats page. Key
// numbers lead in sections; every group sits below, collapsed. Profile columns
// are left out: the page header already shows them. Per-place counts are too,
// since the detail response carries no place list.
export function BuddyStatsSummary({ buddy }: { buddy: AdminBuddyStatsRow }) {
  const t = useTranslations('adminBuddyStats')
  const locale = useLocale()
  const tr = useStatTranslators()
  const columns = buildStatColumns([]).filter((c) => c.group !== 'profile')
  const byId = new Map(columns.map((c) => [c.id, c]))

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-col gap-5 p-4 sm:p-6">
        {KEY_SECTIONS.map((section) => (
          <section key={section.id}>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">{t(`detail.sections.${section.id}`)}</h3>
            <dl className="grid grid-cols-3 gap-2 sm:gap-3">
              {section.columns.map((id) => {
                const column = byId.get(id)
                if (!column) return null
                return (
                  <div key={id} className="flex flex-col justify-between gap-1 rounded-md bg-muted/40 px-2 py-2 sm:px-3">
                    <dt className="text-xs leading-snug text-muted-foreground">{statLabel(column.label, tr, locale)}</dt>
                    <dd className={cn('whitespace-nowrap text-base font-semibold tabular-nums sm:text-xl', isEmpty(column, buddy) && 'text-muted-foreground')}>
                      {formatStat(column, buddy, tr)}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </section>
        ))}
        <p className="text-xs text-muted-foreground">{t('detail.hint')}</p>
      </div>

      <p className="border-t px-6 pt-4 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('detail.allNumbers')}</p>
      <div className="divide-y">
        {STAT_GROUPS.filter((group) => group !== 'profile').map((group) => (
          <details key={group} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-3 text-sm font-medium hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
              {t(`groups.${group}`)}
            </summary>
            <dl className="grid px-6 pb-4 sm:grid-cols-2 sm:gap-x-8">
              {columns.filter((c) => c.group === group).map((column) => (
                <div key={column.id} className="flex items-baseline justify-between gap-4 border-b py-1.5 text-sm">
                  <dt className="text-muted-foreground">{statLabel(column.label, tr, locale)}</dt>
                  <dd className={cn('font-medium tabular-nums', isEmpty(column, buddy) && 'font-normal text-muted-foreground')}>
                    {formatStat(column, buddy, tr)}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
    </div>
  )
}
