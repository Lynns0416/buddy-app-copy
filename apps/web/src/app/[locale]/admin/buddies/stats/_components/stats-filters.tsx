'use client'

import { useLocale, useTranslations } from 'next-intl'
import {
  BuddyStatusSchema,
  BuddyTierSchema,
  GroupTypeSchema,
  type BuddyStatus,
  type BuddyTier,
  type PlaceSummary,
} from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getBuddyStatusLabel, getBuddyTierLabel, getGroupTypeLabel } from '@/lib/status-display'
import { placeName } from '@/lib/place-names'
import {
  defaultBuddyStatsFilters,
  emptyBuddyStatsScope,
  type BuddyStatsFilters,
  type BuddyStatsScope,
} from '../admin.buddy-stats'

type Props = {
  scope: BuddyStatsScope
  onScopeChange: (scope: BuddyStatsScope) => void
  filters: BuddyStatsFilters
  onFiltersChange: (filters: BuddyStatsFilters) => void
  places: PlaceSummary[]
  resultCount: number
  totalCount: number
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}

const selectClass =
  'border-input bg-background flex h-9 rounded-md border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function BuddyStatsFilterBar({
  scope,
  onScopeChange,
  filters,
  onFiltersChange,
  places,
  resultCount,
  totalCount,
}: Props) {
  const t = useTranslations('adminBuddyStats')
  const tStatus = useTranslations('buddyStatus')
  const tTier = useTranslations('buddyTier')
  const tGroupType = useTranslations('groupType')
  const locale = useLocale()

  return (
    <div className="mb-4 flex flex-col gap-4 rounded-lg border bg-card p-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium text-muted-foreground">{t('scope.title')}</legend>
        <p className="text-xs text-muted-foreground">{t('scope.hint')}</p>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="statsFrom" className="text-xs text-muted-foreground">{t('scope.from')}</Label>
            <Input
              id="statsFrom"
              type="date"
              className="w-auto"
              value={scope.from}
              max={scope.to || undefined}
              onChange={(e) => onScopeChange({ ...scope, from: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="statsTo" className="text-xs text-muted-foreground">{t('scope.to')}</Label>
            <Input
              id="statsTo"
              type="date"
              className="w-auto"
              value={scope.to}
              min={scope.from || undefined}
              onChange={(e) => onScopeChange({ ...scope, to: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="statsGroupType" className="text-xs text-muted-foreground">{t('scope.groupType')}</Label>
            <select
              id="statsGroupType"
              className={selectClass}
              value={scope.groupType}
              onChange={(e) => {
                const value = e.target.value
                onScopeChange({ ...scope, groupType: value === '' ? '' : GroupTypeSchema.parse(value) })
              }}
            >
              <option value="">{t('scope.all')}</option>
              {GroupTypeSchema.options.map((groupType) => (
                <option key={groupType} value={groupType}>{getGroupTypeLabel(tGroupType, groupType)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="statsPlace" className="text-xs text-muted-foreground">{t('scope.place')}</Label>
            <select
              id="statsPlace"
              className={selectClass}
              value={scope.placeId}
              onChange={(e) => onScopeChange({ ...scope, placeId: e.target.value })}
            >
              <option value="">{t('scope.all')}</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>{placeName(place, locale)}</option>
              ))}
            </select>
          </div>
          <Button variant="outline" size="sm" onClick={() => onScopeChange(emptyBuddyStatsScope)}>
            {t('scope.allTime')}
          </Button>
        </div>
      </fieldset>

      <Input
        id="statsSearch"
        type="search"
        autoComplete="off"
        aria-label={t('filters.searchLabel')}
        placeholder={t('filters.searchPlaceholder')}
        value={filters.search}
        onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        // Enter only ever confirms an IME candidate here; it must never submit or reload.
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
      />

      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-muted-foreground">{t('filters.status')}</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {BuddyStatusSchema.options.map((status: BuddyStatus) => (
              <label key={status} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={filters.statuses.includes(status)}
                  onChange={() => onFiltersChange({ ...filters, statuses: toggle(filters.statuses, status) })}
                />
                {getBuddyStatusLabel(tStatus, status)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-muted-foreground">{t('filters.tier')}</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {BuddyTierSchema.options.map((tier: BuddyTier) => (
              <label key={tier} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={filters.tiers.includes(tier)}
                  onChange={() => onFiltersChange({ ...filters, tiers: toggle(filters.tiers, tier) })}
                />
                {getBuddyTierLabel(tTier, tier)}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center gap-1.5 self-end pb-1 text-sm">
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
        <Button variant="outline" size="sm" onClick={() => onFiltersChange(defaultBuddyStatsFilters)}>
          {t('filters.reset')}
        </Button>
      </div>
    </div>
  )
}
