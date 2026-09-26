'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { AdminBuddyStatsRow, PlaceSummary } from '@peace-buddy/types'
import { cn } from '@/lib/utils'
import { formatMonth } from '@/lib/format-date'
import { placeName } from '@/lib/place-names'
import { getBuddyTierLabel, getGroupTypeLabel } from '@/lib/status-display'
import { InfoHint } from '@/components/info-hint'
import { statDescription, type StatTranslators } from '../admin.buddy-stats'
import { NO_TIER, type BuddyStatsOverview, type OverviewBucket, type OverviewFocus } from '../stats-overview'

type Props = {
  overview: BuddyStatsOverview
  places: PlaceSummary[]
  tr: StatTranslators
  onFocus: (focus: OverviewFocus) => void
}

const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`)

// Ordered tiers read darkest to lightest; buddies without a tier are neutral.
const TIER_SHADES = ['bg-primary', 'bg-primary/75', 'bg-primary/50', 'bg-primary/30', 'bg-muted-foreground/25']

// What an ⓘ says about a figure or chart whose name alone does not explain it.
type Hint = { label: string; text: string }

function useHint(tr: StatTranslators) {
  const t = useTranslations('adminBuddyStats')
  return (labelKey: string, label: string): Hint | undefined => {
    const text = statDescription(labelKey, tr)
    return text ? { label: t('about', { label }), text } : undefined
  }
}

type Figure = { id: string; label: string; value: string; focus?: Omit<OverviewFocus, 'label'>; hint?: Hint }

function FigureTile({ figure, onFocus }: { figure: Figure; onFocus: Props['onFocus'] }) {
  const body = (
    <>
      <span className="text-2xl font-semibold tabular-nums">{figure.value}</span>
      <span className="text-xs text-muted-foreground">{figure.label}</span>
    </>
  )
  const className = cn(
    'flex h-full w-full flex-col items-start gap-1 rounded-md border bg-background px-3 py-2 text-left',
    figure.hint && 'pr-7',
  )
  const tile = figure.focus ? (
    <button
      type="button"
      className={cn(className, 'transition-colors hover:border-primary hover:bg-accent')}
      onClick={() => onFocus({ label: figure.label, ...figure.focus })}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  )
  if (!figure.hint) return tile
  // The ⓘ is a sibling of the tile's button, not inside it: a button cannot
  // hold another, and hovering it must not also filter the table.
  return (
    <div className="relative">
      {tile}
      <InfoHint label={figure.hint.label} text={figure.hint.text} className="absolute right-2 top-2" />
    </div>
  )
}

function Chart({ title, hint, children }: { title: string; hint?: Hint; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col gap-3 rounded-md border bg-background p-3">
      <figcaption className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {title}
        {hint && <InfoHint label={hint.label} text={hint.text} />}
      </figcaption>
      {children}
    </figure>
  )
}

type Bar = { bucket: OverviewBucket; label: string; value?: number | null; display?: string }

// Horizontal bars as a list of buttons: readable without a chart library, and
// each bar narrows the table to the buddies behind it.
function BarList({
  title,
  hint,
  bars,
  max,
  onFocus,
}: {
  title: string
  hint?: Hint
  bars: Bar[]
  max?: number
  onFocus: Props['onFocus']
}) {
  const t = useTranslations('adminBuddyStats')
  const valueOf = (bar: Bar) => (bar.value === undefined ? bar.bucket.value : bar.value)
  const top = max ?? Math.max(1, ...bars.map((b) => valueOf(b) ?? 0))
  return (
    <Chart title={title} hint={hint}>
      <ul className="flex flex-col gap-1.5">
        {bars.map((bar) => {
          const value = valueOf(bar)
          const display = bar.display ?? String(value ?? '—')
          return (
            <li key={bar.bucket.id}>
              <button
                type="button"
                className="grid w-full grid-cols-[minmax(0,8rem)_1fr_3rem] items-center gap-2 rounded px-1 py-0.5 text-left text-sm transition-colors hover:bg-accent"
                aria-label={`${bar.label}: ${display}`}
                onClick={() =>
                  onFocus({
                    label: t('overview.bucketFocus', { chart: title, bucket: bar.label }),
                    match: bar.bucket.match,
                    sortField: bar.bucket.sortField,
                  })
                }
              >
                <span className="truncate">{bar.label}</span>
                <span className="h-3 rounded-sm bg-muted">
                  <span
                    className="block h-full rounded-sm bg-primary"
                    style={{ width: `${((value ?? 0) / top) * 100}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">{display}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Chart>
  )
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

// One column per month. Only the first and last month are labelled under the
// axis; each column names its month and count to hover and screen readers.
function RegistrationChart({ overview, onFocus }: Pick<Props, 'overview' | 'onFocus'>) {
  const t = useTranslations('adminBuddyStats')
  const title = t('overview.charts.registrations')
  const months = overview.registrations
  if (months.length === 0) return null
  const top = Math.max(1, ...months.map((m) => m.value))
  return (
    <Chart title={title}>
      <div className="flex h-28 items-end gap-px">
        {months.map((m) => {
          const label = t('overview.monthCount', { month: formatMonth(m.id), count: m.value })
          return (
            <button
              key={m.id}
              type="button"
              title={label}
              aria-label={label}
              className="group flex h-full min-w-1 flex-1 items-end"
              onClick={() =>
                onFocus({
                  label: t('overview.bucketFocus', { chart: title, bucket: formatMonth(m.id) }),
                  match: m.match,
                  sortField: m.sortField,
                })
              }
            >
              <span
                className="block w-full rounded-t-sm bg-primary transition-colors group-hover:bg-primary/70"
                style={{ height: `${(m.value / top) * 100}%` }}
              />
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>{formatMonth(months[0].id)}</span>
        <span>{formatMonth(months[months.length - 1].id)}</span>
      </div>
    </Chart>
  )
}

// Figures across every buddy in the table, above it. Clicking a figure or a bar
// narrows and sorts the table to the buddies behind it (PRD §11.4 "Overview").
export function BuddyStatsOverviewPanel({ overview, places, tr, onFocus }: Props) {
  const t = useTranslations('adminBuddyStats')
  const locale = useLocale()
  const col = (key: string) => t(`columns.${key}`)
  const hint = useHint(tr)
  const any = (pick: (r: AdminBuddyStatsRow) => number) => (r: AdminBuddyStatsRow) => pick(r) > 0

  const figures: Figure[] = [
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
          <FigureTile key={figure.id} figure={{ ...figure, hint: hint(figure.id, figure.label) }} onFocus={onFocus} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TierBar overview={overview} tr={tr} onFocus={onFocus} />
        <RegistrationChart overview={overview} onFocus={onFocus} />
        <BarList
          title={t('overview.charts.activity')}
          bars={overview.activity.map((bucket) => ({ bucket, label: bucket.id }))}
          onFocus={onFocus}
        />
        <BarList
          title={t('overview.charts.recency')}
          bars={overview.recency.map((bucket) => ({ bucket, label: t(`overview.recency.${bucket.id}`) }))}
          onFocus={onFocus}
        />
        <BarList
          title={t('overview.charts.categories')}
          bars={overview.categories.map((bucket) => ({ bucket, label: tr.tBuddies(`cancelCategory.${bucket.id}`) }))}
          onFocus={onFocus}
        />
        <BarList
          title={t('overview.charts.groupTypes')}
          bars={overview.groupTypes.map((bucket) => ({ bucket, label: getGroupTypeLabel(tr.tGroupType, bucket.id) }))}
          onFocus={onFocus}
        />
        {overview.places.length > 0 && (
          <BarList
            title={t('overview.charts.places')}
            bars={overview.places.map((bucket) => {
              const place = placeById.get(bucket.id)
              return { bucket, label: place ? placeName(place, locale) : '' }
            })}
            onFocus={onFocus}
          />
        )}
        <BarList
          title={t('overview.charts.scores')}
          hint={hint('averageScore', t('overview.charts.scores'))}
          max={5}
          bars={overview.scores.map((s) => ({
            bucket: {
              id: s.score,
              value: s.count,
              match: (r: AdminBuddyStatsRow) => r.stats.scoreCounts[s.score] > 0,
              sortField: `averageScore.${s.score}`,
            },
            label: tr.tEval(`fields.${s.score}`),
            value: s.average,
            display: s.average === null ? '—' : s.average.toFixed(1),
          }))}
          onFocus={onFocus}
        />
      </div>
    </section>
  )
}
