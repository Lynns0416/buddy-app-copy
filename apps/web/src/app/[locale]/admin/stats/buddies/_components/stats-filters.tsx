'use client'

import { useTranslations } from 'next-intl'
import {
  BuddyStatusSchema,
  BuddyTierSchema,
  type BuddyStatus,
  type BuddyTier,
  type PlaceSummary,
} from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { SuggestInput } from '@/components/suggest-input'
import { getBuddyStatusLabel, getBuddyTierLabel } from '@/lib/status-display'
import { defaultBuddyStatsFilters, type BuddyStatsFilters, type BuddyStatsScope } from '../admin.buddy-stats'
import { StatsScopeFields } from '../../_components/scope-fields'

type Props = {
  scope: BuddyStatsScope
  onScopeChange: (scope: BuddyStatsScope) => void
  filters: BuddyStatsFilters
  onFiltersChange: (filters: BuddyStatsFilters) => void
  places: PlaceSummary[]
  buddyNames: string[]
  resultCount: number
  totalCount: number
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}

export function BuddyStatsFilterBar({
  scope,
  onScopeChange,
  filters,
  onFiltersChange,
  places,
  buddyNames,
  resultCount,
  totalCount,
}: Props) {
  const t = useTranslations('adminBuddyStats')
  const tStatus = useTranslations('buddyStatus')
  const tTier = useTranslations('buddyTier')

  return (
    <div className="mb-4 flex flex-col gap-4 rounded-lg border bg-card p-4">
      <StatsScopeFields scope={scope} onScopeChange={onScopeChange} hint={t('scope.hint')} places={places} />

      <SuggestInput
        id="statsSearch"
        suggestions={buddyNames}
        aria-label={t('filters.searchLabel')}
        placeholder={t('filters.searchPlaceholder')}
        value={filters.search}
        onChange={(search) => onFiltersChange({ ...filters, search })}
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
