'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { AdminReflectionStatsPlace } from '@peace-buddy/types'
import { formatMonth } from '@/lib/format-date'
import { placeName } from '@/lib/place-names'
import {
  BarItems,
  BarList,
  Chart,
  FigureTile,
  MonthChart,
  percent,
  type Bar,
  type Figure,
  type Hint,
} from '../../_components/overview-parts'
import type { ReflectionBucket, ReflectionFocus, ReflectionOverview } from '../admin.reflection-stats'

type Props = {
  overview: ReflectionOverview
  places: AdminReflectionStatsPlace[]
  onFocus: (focus: ReflectionFocus) => void
}

// Figures and charts across every reflection the list shows. Clicking a bar
// narrows the list to the reflections behind it (PRD §11.4 "Reflection Stats Page").
export function ReflectionOverviewPanel({ overview, places, onFocus }: Props) {
  const t = useTranslations('adminReflectionStats')
  const locale = useLocale()
  const hint = (key: string, label: string): Hint => ({
    label: t('about', { label }),
    text: t(`descriptions.${key}`),
  })

  const spotById = new Map(places.flatMap((p) => p.spots.map((s) => [s.id, s] as const)))
  const placeById = new Map(places.map((p) => [p.id, p]))

  const toBars = (title: string, buckets: ReflectionBucket[], labelOf: (id: string) => string): Bar[] =>
    buckets.map((bucket) => {
      const label = labelOf(bucket.id)
      return {
        id: bucket.id,
        label,
        value: bucket.value,
        onSelect: () => onFocus({ label: t('overview.bucketFocus', { chart: title, bucket: label }), match: bucket.match }),
      }
    })

  const spotLabel = (id: string) => {
    const spot = spotById.get(id)
    return spot ? placeName(spot, locale) : t('noSpot')
  }
  const placeLabel = (id: string) => {
    const place = placeById.get(id)
    return place ? placeName(place, locale) : ''
  }

  const figures: Figure[] = [
    { id: 'reflections', label: t('overview.reflections'), value: String(overview.reflections) },
    { id: 'buddiesWrote', label: t('overview.buddiesWrote'), value: String(overview.buddiesWrote) },
    { id: 'moments', label: t('overview.moments'), value: String(overview.moments) },
    {
      id: 'reflectionRate',
      label: t('overview.reflectionRate'),
      value: percent(overview.reflectionRate),
      hint: hint('reflectionRate', t('overview.reflectionRate')),
    },
  ]

  const spotsTitle = t('overview.charts.spots')
  const spotMax = Math.max(1, ...overview.spots.flatMap((g) => g.bars.map((b) => b.value)))
  const placesTitle = t('overview.charts.places')
  const monthsTitle = t('overview.charts.months')

  return (
    <section className="mb-4 flex flex-col gap-4 rounded-lg border bg-card p-4" aria-labelledby="reflectionOverviewTitle">
      <div>
        <h2 id="reflectionOverviewTitle" className="text-sm font-medium">{t('overview.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('overview.hint')}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {figures.map((figure) => <FigureTile key={figure.id} figure={figure} />)}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {overview.spots.length > 0 && (
          <Chart title={spotsTitle}>
            {overview.spots.map((group) => (
              <div key={group.place.id} className="flex flex-col gap-1.5">
                <h3 className="text-xs text-muted-foreground">{placeName(group.place, locale)}</h3>
                <BarItems bars={toBars(spotsTitle, group.bars, spotLabel)} max={spotMax} />
              </div>
            ))}
          </Chart>
        )}
        <div className="flex flex-col gap-3">
          <BarList
            title={placesTitle}
            hint={hint('places', placesTitle)}
            bars={toBars(placesTitle, overview.places, placeLabel)}
          />
          <MonthChart
            title={monthsTitle}
            months={overview.months.map((m) => ({
              month: m.id,
              value: m.value,
              label: t('overview.monthCount', { month: formatMonth(m.id), count: m.value }),
              onSelect: () =>
                onFocus({
                  label: t('overview.bucketFocus', { chart: monthsTitle, bucket: formatMonth(m.id) }),
                  match: m.match,
                }),
            }))}
          />
        </div>
      </div>
    </section>
  )
}
