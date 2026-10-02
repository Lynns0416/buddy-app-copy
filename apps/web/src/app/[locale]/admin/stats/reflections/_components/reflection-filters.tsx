'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { AdminReflectionStatsPlace } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SuggestInput } from '@/components/suggest-input'
import { placeName } from '@/lib/place-names'
import { StatsScopeFields, statsSelectClass } from '../../_components/scope-fields'
import {
  defaultReflectionStatsFilters,
  spotKey,
  type ReflectionStatsFilters,
  type ReflectionStatsScope,
} from '../admin.reflection-stats'

type Props = {
  scope: ReflectionStatsScope
  onScopeChange: (scope: ReflectionStatsScope) => void
  // The tour the scope is narrowed to, as the page can name it; null when none is.
  tourLabel: string | null
  onClearTour: () => void
  filters: ReflectionStatsFilters
  onFiltersChange: (filters: ReflectionStatsFilters) => void
  places: AdminReflectionStatsPlace[]
  buddyNames: string[]
  resultCount: number
  totalCount: number
}

// Enter only ever confirms an IME candidate in a search box; it must never submit or reload.
const keepEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') e.preventDefault() }

export function ReflectionStatsFilterBar({
  scope,
  onScopeChange,
  tourLabel,
  onClearTour,
  filters,
  onFiltersChange,
  places,
  buddyNames,
  resultCount,
  totalCount,
}: Props) {
  const t = useTranslations('adminReflectionStats')
  const locale = useLocale()
  const spotPlaces = places.filter((p) => p.spots.length > 0)

  return (
    <div className="mb-4 flex flex-col gap-4 rounded-lg border bg-card p-4">
      <StatsScopeFields scope={scope} onScopeChange={onScopeChange} hint={t('scope.hint')} places={places}>
        {scope.tourId && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{t('scope.tour', { tour: tourLabel ?? t('scope.tourUnknown') })}</span>
            <Button variant="outline" size="sm" onClick={onClearTour}>
              {t('scope.clearTour')}
            </Button>
          </div>
        )}
      </StatsScopeFields>

      <div className="grid gap-3 sm:grid-cols-2">
        <SuggestInput
          suggestions={buddyNames}
          aria-label={t('filters.buddyLabel')}
          placeholder={t('filters.buddyPlaceholder')}
          value={filters.buddy}
          onChange={(buddy) => onFiltersChange({ ...filters, buddy })}
        />
        <Input
          type="search"
          autoComplete="off"
          aria-label={t('filters.textLabel')}
          placeholder={t('filters.textPlaceholder')}
          value={filters.text}
          onChange={(e) => onFiltersChange({ ...filters, text: e.target.value })}
          onKeyDown={keepEnter}
        />
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reflectionSpot" className="text-xs text-muted-foreground">{t('filters.spot')}</Label>
          <select
            id="reflectionSpot"
            className={statsSelectClass}
            value={filters.spot}
            onChange={(e) => onFiltersChange({ ...filters, spot: e.target.value })}
          >
            <option value="">{t('filters.allSpots')}</option>
            {spotPlaces.map((place) => (
              <optgroup key={place.id} label={placeName(place, locale)}>
                {place.spots.map((spot) => (
                  <option key={spot.id} value={spot.id}>{placeName(spot, locale)}</option>
                ))}
                <option value={spotKey(place.id, null)}>{t('noSpot')}</option>
              </optgroup>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-1.5 pb-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={filters.openQuestionsOnly}
            onChange={() => onFiltersChange({ ...filters, openQuestionsOnly: !filters.openQuestionsOnly })}
          />
          {t('filters.openQuestionsOnly')}
        </label>

        <label className="flex items-center gap-1.5 pb-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={filters.includePlabMembers}
            onChange={() => onFiltersChange({ ...filters, includePlabMembers: !filters.includePlabMembers })}
          />
          {t('filters.includePlabMembers')}
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t('filters.resultCount', { count: resultCount, total: totalCount })}
        </p>
        <Button variant="outline" size="sm" onClick={() => onFiltersChange(defaultReflectionStatsFilters)}>
          {t('filters.reset')}
        </Button>
      </div>
    </div>
  )
}
