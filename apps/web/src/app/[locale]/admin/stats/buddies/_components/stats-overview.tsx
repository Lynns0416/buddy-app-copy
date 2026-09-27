'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { AdminBuddyStatsRow, PlaceSummary } from '@peace-buddy/types'
import { cn } from '@/lib/utils'
import { formatMonth } from '@/lib/format-date'
import { placeName } from '@/lib/place-names'
import { getBuddyTierLabel, getGroupTypeLabel } from '@/lib/status-display'
import { statDescription, type StatTranslators } from '../admin.buddy-stats'
import { NO_TIER, type BuddyStatsOverview, type OverviewBucket, type OverviewFocus } from '../stats-overview'
import { BarList, Chart, FigureTile, MonthChart, percent, type Bar, type Figure, type Hint } from '../../_components/overview-parts'

type Props = {
  overview: BuddyStatsOverview
  places: PlaceSummary[]
  tr: StatTranslators
  onFocus: (focus: OverviewFocus) => void
}

// Ordered tiers read darkest to lightest; buddies without a tier are neutral.
const TIER_SHADES = ['bg-primary', 'bg-primary/75', 'bg-primary/50', 'bg-primary/30', 'bg-muted-foreground/25']

function useHint(tr: StatTranslators) {
  const t = useTranslations('adminBuddyStats')
  return (labelKey: string, label: string): Hint | undefined => {
    const text = statDescription(labelKey, tr)
    return text ? { label: t('about', { label }), text } : undefined
  }
}

type BuddyFigure = Omit<Figure, 'onSelect'> & { focus?: Omit<OverviewFocus, 'label'> }

type BuddyBar = { bucket: OverviewBucket; label: string; value?: number | null; display?: string }

// A bar narrows the table to the buddies in its bucket and sorts by its column.
function useBars(onFocus: Props['onFocus']) {
  const t = useTranslations('adminBuddyStats')
  return (title: string, bars: BuddyBar[]): Bar[] =>
    bars.map((bar) => ({
      id: bar.bucket.id,
      label: bar.label,
      value: bar.value === undefined ? bar.bucket.value : bar.value,
      display: bar.display,
      onSelect: () =>
        onFocus({
          label: t('overview.bucketFocus', { chart: title, bucket: bar.label }),
          match: bar.bucket.match,
          sortField: bar.bucket.sortField,
        }),
    }))
}

function TierBar({ overview, tr, onFocus }: Pick<Props, 'overview' | 'tr' | 'onFocus'>) {
  const t = useTranslations('adminBuddyStats')
  const title = t('overview.charts.tiers')
  const total = Math.max(1, overview.buddies)
  const segments = overview.tiers.map((bucket, i) => ({
    bucket,
    shade: TIER_SHADES[i],
    label: bucket.id === NO_TIER ? t('overview.noTier') : getBuddyTierLabel(tr.tTier, bucket.id),
  }))
  const focus = (s: (typeof segments)[number]) =>
    onFocus({ label: t('overview.bucketFocus', { chart: title, bucket: s.label }), match: s.bucket.match })
  return (
    <Chart title={title}>
      <div className="flex h-6 overflow-hidden rounded-sm bg-muted" aria-hidden>
        {segments.filter((s) => s.bucket.value > 0).map((s) => (
          <span key={s.bucket.id} className={s.shade} style={{ width: `${(s.bucket.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <li key={s.bucket.id}>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded px-1 text-sm transition-colors hover:bg-accent"
              onClick={() => focus(s)}
            >
              <span className={cn('h-3 w-3 rounded-sm', s.shade)} aria-hidden />
              {s.label}
              <span className="tabular-nums text-muted-foreground">{s.bucket.value}</span>
            </button>
          </li>
        ))}
      </ul>
    </Chart>
  )
}

function RegistrationChart({ overview, onFocus }: Pick<Props, 'overview' | 'onFocus'>) {
  const t = useTranslations('adminBuddyStats')
  const title = t('overview.charts.registrations')
  return (
    <MonthChart
      title={title}
      months={overview.registrations.map((m) => ({
        month: m.id,
        value: m.value,
        label: t('overview.monthCount', { month: formatMonth(m.id), count: m.value }),
        onSelect: () =>
          onFocus({
            label: t('overview.bucketFocus', { chart: title, bucket: formatMonth(m.id) }),
            match: m.match,
            sortField: m.sortField,
          }),
      }))}
    />
  )
}

// Figures across every buddy in the table, above it. Clicking a figure or a bar
// narrows and sorts the table to the buddies behind it (PRD §11.4 "Overview").
export function BuddyStatsOverviewPanel({ overview, places, tr, onFocus }: Props) {
  const t = useTranslations('adminBuddyStats')
  const locale = useLocale()
  const col = (key: string) => t(`columns.${key}`)
  const hint = useHint(tr)
  const bars = useBars(onFocus)
  const any = (pick: (r: AdminBuddyStatsRow) => number) => (r: AdminBuddyStatsRow) => pick(r) > 0

  const figures: BuddyFigure[] = [
    { id: 'buddies', label: t('overview.buddies'), value: String(overview.buddies) },
    {
      id: 'everAttended',
      label: t('overview.everAttended'),
      value: String(overview.everAttended),
      focus: { match: any((r) => r.stats.sessionsAttended), sortField: 'sessionsAttended' },
    },
    { id: 'sessionsAttended', label: col('sessionsAttended'), value: String(overview.sessionsAttended), focus: { sortField: 'sessionsAttended' } },
    { id: 'hoursVolunteered', label: col('hoursVolunteered'), value: (overview.minutesVolunteered / 60).toFixed(1), focus: { sortField: 'hoursVolunteered' } },
    { id: 'attendanceRate', label: col('attendanceRate'), value: percent(overview.attendanceRate), focus: { sortField: 'attendanceRate' } },
    { id: 'noShows', label: col('noShows'), value: String(overview.noShows), focus: { match: any((r) => r.stats.noShows), sortField: 'noShows' } },
    {
      id: 'lateCancellations',
      label: col('lateCancellations'),
      value: String(overview.lateCancellations),
      focus: { match: any((r) => r.stats.lateCancellations), sortField: 'lateCancellations' },
    },
    { id: 'cancellationRate', label: col('cancellationRate'), value: percent(overview.cancellationRate), focus: { sortField: 'cancellationRate' } },
    { id: 'reflectionRate', label: col('reflectionRate'), value: percent(overview.reflectionRate), focus: { sortField: 'reflectionRate' } },
    {
      id: 'cancellationsUnreviewed',
      label: col('cancellationsUnreviewed'),
      value: String(overview.cancellationsUnreviewed),
      focus: { match: any((r) => r.stats.cancellationsUnreviewed), sortField: 'cancellationsUnreviewed' },
    },
    {
      id: 'evaluationsMissing',
      label: col('evaluationsMissing'),
      value: String(overview.evaluationsMissing),
      focus: { match: any((r) => r.stats.evaluationsMissing), sortField: 'evaluationsMissing' },
    },
  ]

  const placeById = new Map(places.map((p) => [p.id, p]))

  return (
    <section className="mb-4 flex flex-col gap-4 rounded-lg border bg-card p-4" aria-labelledby="statsOverviewTitle">
      <div>
        <h2 id="statsOverviewTitle" className="text-sm font-medium">{t('overview.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('overview.hint')}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {figures.map((figure) => (
          <FigureTile
            key={figure.id}
            figure={{
              id: figure.id,
              label: figure.label,
              value: figure.value,
              hint: hint(figure.id, figure.label),
              onSelect: figure.focus && (() => onFocus({ label: figure.label, ...figure.focus })),
            }}
          />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TierBar overview={overview} tr={tr} onFocus={onFocus} />
        <RegistrationChart overview={overview} onFocus={onFocus} />
        <BarList
          title={t('overview.charts.activity')}
          bars={bars(t('overview.charts.activity'), overview.activity.map((bucket) => ({ bucket, label: bucket.id })))}
        />
        <BarList
          title={t('overview.charts.recency')}
          bars={bars(
            t('overview.charts.recency'),
            overview.recency.map((bucket) => ({ bucket, label: t(`overview.recency.${bucket.id}`) })),
          )}
        />
        <BarList
          title={t('overview.charts.categories')}
          bars={bars(
            t('overview.charts.categories'),
            overview.categories.map((bucket) => ({ bucket, label: tr.tBuddies(`cancelCategory.${bucket.id}`) })),
          )}
        />
        <BarList
          title={t('overview.charts.groupTypes')}
          bars={bars(
            t('overview.charts.groupTypes'),
            overview.groupTypes.map((bucket) => ({ bucket, label: getGroupTypeLabel(tr.tGroupType, bucket.id) })),
          )}
        />
        {overview.places.length > 0 && (
          <BarList
            title={t('overview.charts.places')}
            bars={bars(
              t('overview.charts.places'),
              overview.places.map((bucket) => {
                const place = placeById.get(bucket.id)
                return { bucket, label: place ? placeName(place, locale) : '' }
              }),
            )}
          />
        )}
        <BarList
          title={t('overview.charts.scores')}
          hint={hint('averageScore', t('overview.charts.scores'))}
          max={5}
          bars={bars(
            t('overview.charts.scores'),
            overview.scores.map((s) => ({
              bucket: {
                id: s.score,
                value: s.count,
                match: (r: AdminBuddyStatsRow) => r.stats.scoreCounts[s.score] > 0,
                sortField: `averageScore.${s.score}`,
              },
              label: tr.tEval(`fields.${s.score}`),
              value: s.average,
              display: s.average === null ? '—' : s.average.toFixed(1),
            })),
          )}
        />
      </div>
    </section>
  )
}
